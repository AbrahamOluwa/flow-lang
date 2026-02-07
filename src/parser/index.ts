import {
    Token, TokenType, FlowError,
    Program, ConfigBlock, ConfigEntry,
    ServicesBlock, ServiceDeclaration, ServiceType,
    WorkflowBlock, TriggerDeclaration,
    Statement, StepBlock, ServiceCall, Parameter,
    AskStatement, SetStatement, IfStatement, OtherwiseIf,
    ForEachStatement, LogStatement, CompleteStatement, RejectStatement,
    ErrorHandler,
    Expression, StringLiteral, InterpolatedString, InterpolationPart,
    NumberLiteral, BooleanLiteral, Identifier, DotAccess,
    MathExpression, MathOperator, ComparisonExpression, ComparisonOperator,
    LogicalExpression,
    SourceLocation,
} from "../types/index.js";
import { createError } from "../errors/index.js";

// ============================================================
// Parser error class
// ============================================================

export class ParserError extends Error {
    public readonly flowError: FlowError;

    constructor(flowError: FlowError) {
        super(flowError.message);
        this.name = "ParserError";
        this.flowError = flowError;
    }
}

// ============================================================
// Parser result
// ============================================================

export interface ParseResult {
    program: Program;
    errors: FlowError[];
}

// ============================================================
// Keyword sets for dispatch
// ============================================================

const COMPARISON_OPERATORS = new Set<string>([
    "is", "is not", "is above", "is below",
    "is at least", "is at most", "contains",
    "is empty", "is not empty", "exists", "does not exist",
]);

const UNARY_COMPARISON_OPERATORS = new Set<string>([
    "is empty", "is not empty", "exists", "does not exist",
]);

const MATH_OPERATORS = new Set<string>([
    "plus", "minus", "times", "divided by", "rounded to",
]);

// ============================================================
// Parser
// ============================================================

export function parse(tokens: Token[], source: string, fileName: string = "<input>"): ParseResult {
    let pos = 0;
    const errors: FlowError[] = [];

    // --------------------------------------------------------
    // Token navigation
    // --------------------------------------------------------

    function current(): Token {
        return tokens[pos] ?? { type: TokenType.EOF, value: "", line: 0, column: 0 };
    }

    function peek(): Token {
        return tokens[pos] ?? { type: TokenType.EOF, value: "", line: 0, column: 0 };
    }

    function peekNext(): Token {
        return tokens[pos + 1] ?? { type: TokenType.EOF, value: "", line: 0, column: 0 };
    }

    function advance(): Token {
        const tok = current();
        if (tok.type !== TokenType.EOF) {
            pos++;
        }
        return tok;
    }

    function loc(): SourceLocation {
        const tok = current();
        return { line: tok.line, column: tok.column };
    }

    function atEnd(): boolean {
        return current().type === TokenType.EOF;
    }

    function check(type: TokenType, value?: string): boolean {
        const tok = current();
        if (tok.type !== type) return false;
        if (value !== undefined && tok.value !== value) return false;
        return true;
    }

    function match(type: TokenType, value?: string): Token | null {
        if (check(type, value)) {
            return advance();
        }
        return null;
    }

    function expect(type: TokenType, value?: string, context?: string): Token {
        const tok = current();
        if (tok.type === type && (value === undefined || tok.value === value)) {
            return advance();
        }
        const expected = value ? `"${value}"` : type;
        const ctx = context ? ` ${context}` : "";
        addError(
            tok,
            `Expected ${expected}${ctx}, but found "${tok.value}" (${tok.type}).`,
        );
        // Return a synthetic token so parsing can continue
        return { type, value: value ?? "", line: tok.line, column: tok.column };
    }

    // --------------------------------------------------------
    // Error handling
    // --------------------------------------------------------

    function addError(tok: Token, message: string, suggestion?: string, hint?: string): void {
        errors.push(createError(fileName, tok.line, tok.column, message, source, { suggestion, hint }));
    }

    function skipToNextStatement(): void {
        // Skip tokens until we reach a NEWLINE at the current or lower indent level,
        // or DEDENT, or EOF
        while (!atEnd()) {
            const tok = current();
            if (tok.type === TokenType.NEWLINE || tok.type === TokenType.DEDENT || tok.type === TokenType.EOF) {
                return;
            }
            advance();
        }
    }

    // --------------------------------------------------------
    // Newline consumption
    // --------------------------------------------------------

    function skipNewlines(): void {
        while (match(TokenType.NEWLINE)) { /* skip */ }
    }

    function expectNewline(): void {
        if (!match(TokenType.NEWLINE) && !atEnd() && !check(TokenType.DEDENT)) {
            addError(current(), "Expected end of line.");
            skipToNextStatement();
        }
    }

    // --------------------------------------------------------
    // Top-level: Program
    // --------------------------------------------------------

    function parseProgram(): Program {
        const location = loc();
        let config: ConfigBlock | null = null;
        let services: ServicesBlock | null = null;
        let workflow: WorkflowBlock | null = null;

        skipNewlines();

        while (!atEnd()) {
            const tok = current();

            if (tok.type === TokenType.KEYWORD && tok.value === "config") {
                if (config !== null) {
                    addError(tok, "Duplicate config block. You can only have one config block per file.");
                }
                config = parseConfigBlock();
            } else if (tok.type === TokenType.KEYWORD && tok.value === "services") {
                if (services !== null) {
                    addError(tok, "Duplicate services block. You can only have one services block per file.");
                }
                services = parseServicesBlock();
            } else if (tok.type === TokenType.KEYWORD && tok.value === "workflow") {
                if (workflow !== null) {
                    addError(tok, "Duplicate workflow block. You can only have one workflow block per file.");
                }
                workflow = parseWorkflowBlock();
            } else if (tok.type === TokenType.NEWLINE || tok.type === TokenType.INDENT || tok.type === TokenType.DEDENT) {
                advance();
            } else {
                addError(
                    tok,
                    `I found "${tok.value}" at the top level, but Flow files can only have "config:", "services:", or "workflow:" blocks at the top level.`,
                    "Check your indentation — this might be a statement that should be inside a block.",
                    'A Flow file looks like:\n    config:\n        ...\n    services:\n        ...\n    workflow:\n        ...'
                );
                skipToNextStatement();
                skipNewlines();
            }
        }

        return { kind: "Program", config, services, workflow, loc: location };
    }

    // --------------------------------------------------------
    // Config block
    // --------------------------------------------------------

    function parseConfigBlock(): ConfigBlock {
        const location = loc();
        expect(TokenType.KEYWORD, "config");
        expect(TokenType.COLON);
        expectNewline();

        const entries: ConfigEntry[] = [];

        if (!match(TokenType.INDENT)) {
            addError(current(), "Expected indented config entries after \"config:\".",
                "Add your config settings indented under config:",
                'Example:\n    config:\n        name: "My Workflow"\n        version: 1');
            return { kind: "ConfigBlock", entries, loc: location };
        }

        while (!check(TokenType.DEDENT) && !atEnd()) {
            skipNewlines();
            if (check(TokenType.DEDENT) || atEnd()) break;

            const entry = parseConfigEntry();
            if (entry) entries.push(entry);
            skipNewlines();
        }

        match(TokenType.DEDENT);
        return { kind: "ConfigBlock", entries, loc: location };
    }

    function parseConfigEntry(): ConfigEntry | null {
        const location = loc();
        const keyToken = current();

        if (keyToken.type !== TokenType.KEYWORD && keyToken.type !== TokenType.IDENTIFIER) {
            addError(keyToken, `Expected a config key (like "name", "version", or "timeout"), but found "${keyToken.value}".`);
            skipToNextStatement();
            return null;
        }

        const key = advance().value;
        expect(TokenType.COLON, undefined, "after config key");

        // Value can be a string, number, or number + unit (like "5 minutes")
        const valTok = current();
        let value: string | number;

        if (valTok.type === TokenType.STRING) {
            value = advance().value;
        } else if (valTok.type === TokenType.NUMBER) {
            const numStr = advance().value;
            // Check if there's a unit after the number (e.g., "5 minutes")
            if (!check(TokenType.NEWLINE) && !check(TokenType.DEDENT) && !atEnd()) {
                let text = numStr;
                while (!check(TokenType.NEWLINE) && !check(TokenType.DEDENT) && !atEnd()) {
                    text += " " + advance().value;
                }
                value = text;
            } else {
                value = Number(numStr);
            }
        } else if (valTok.type === TokenType.IDENTIFIER || valTok.type === TokenType.KEYWORD) {
            // Could be something like "5 minutes" — collect rest of line as string
            let text = "";
            while (!check(TokenType.NEWLINE) && !check(TokenType.DEDENT) && !atEnd()) {
                if (text.length > 0) text += " ";
                text += advance().value;
            }
            value = text;
        } else {
            addError(valTok, `Expected a value after "${key}:", but found "${valTok.value}".`);
            skipToNextStatement();
            return null;
        }

        expectNewline();
        return { kind: "ConfigEntry", key, value, loc: location };
    }

    // --------------------------------------------------------
    // Services block
    // --------------------------------------------------------

    function parseServicesBlock(): ServicesBlock {
        const location = loc();
        expect(TokenType.KEYWORD, "services");
        expect(TokenType.COLON);
        expectNewline();

        const declarations: ServiceDeclaration[] = [];

        if (!match(TokenType.INDENT)) {
            addError(current(), "Expected indented service declarations after \"services:\".",
                "Add your services indented under services:",
                'Example:\n    services:\n        MyAPI is an API at "https://..."');
            return { kind: "ServicesBlock", declarations, loc: location };
        }

        while (!check(TokenType.DEDENT) && !atEnd()) {
            skipNewlines();
            if (check(TokenType.DEDENT) || atEnd()) break;

            const decl = parseServiceDeclaration();
            if (decl) declarations.push(decl);
            skipNewlines();
        }

        match(TokenType.DEDENT);
        return { kind: "ServicesBlock", declarations, loc: location };
    }

    function parseServiceDeclaration(): ServiceDeclaration | null {
        const location = loc();
        const nameTok = current();

        if (nameTok.type !== TokenType.IDENTIFIER) {
            addError(nameTok,
                `Expected a service name (like "Stripe" or "EmailVerifier"), but found "${nameTok.value}".`,
                "Service names should start with a capital letter.",
                'Example: Stripe is a plugin "flow-connector-stripe"');
            skipToNextStatement();
            return null;
        }

        const name = advance().value;

        // Expect "is"
        if (!match(TokenType.KEYWORD, "is")) {
            addError(current(),
                `Expected "is" after service name "${name}".`,
                undefined,
                `Example: ${name} is an API at "https://..."`);
            skipToNextStatement();
            return null;
        }

        // Determine service type: "an API at", "an AI using", "a plugin", "a webhook at"
        let serviceType: ServiceType;
        const article = current();

        // "an" is an identifier (not a keyword)
        if (article.value === "an") {
            advance();
            const typeTok = current();

            if (typeTok.type === TokenType.IDENTIFIER && typeTok.value === "API") {
                advance();
                serviceType = "api";
                expect(TokenType.KEYWORD, "at", "after \"API\"");
            } else if (typeTok.type === TokenType.IDENTIFIER && typeTok.value === "AI") {
                advance();
                serviceType = "ai";
                expect(TokenType.KEYWORD, "using", "after \"AI\"");
            } else {
                addError(typeTok,
                    `Expected "API" or "AI" after "is an", but found "${typeTok.value}".`,
                    undefined,
                    `Valid service types:\n    ${name} is an API at "https://..."\n    ${name} is an AI using "model-name"`);
                skipToNextStatement();
                return null;
            }
        } else if (article.value === "a") {
            advance();
            const typeTok = current();

            if (typeTok.type === TokenType.IDENTIFIER && typeTok.value === "plugin") {
                advance();
                serviceType = "plugin";
            } else if (typeTok.type === TokenType.IDENTIFIER && typeTok.value === "webhook") {
                advance();
                serviceType = "webhook";
                expect(TokenType.KEYWORD, "at", "after \"webhook\"");
            } else {
                addError(typeTok,
                    `Expected "plugin" or "webhook" after "is a", but found "${typeTok.value}".`,
                    undefined,
                    `Valid service types:\n    ${name} is a plugin "package-name"\n    ${name} is a webhook at "/path"`);
                skipToNextStatement();
                return null;
            }
        } else {
            addError(article,
                `Expected "an" or "a" after "is" in service declaration, but found "${article.value}".`,
                undefined,
                `Valid service types:\n    ${name} is an API at "https://..."\n    ${name} is an AI using "model-name"\n    ${name} is a plugin "package-name"\n    ${name} is a webhook at "/path"`);
            skipToNextStatement();
            return null;
        }

        // Parse the target (URL, model name, package name, or path)
        const targetTok = current();
        if (targetTok.type !== TokenType.STRING) {
            addError(targetTok,
                `Expected a quoted string for the service target, but found "${targetTok.value}".`,
                'Wrap the value in double quotes.',
                `Example: ${name} is ${serviceType === "api" ? 'an API at' : serviceType === "ai" ? 'an AI using' : serviceType === "plugin" ? 'a plugin' : 'a webhook at'} "value-here"`);
            skipToNextStatement();
            return null;
        }
        const target = advance().value;

        expectNewline();
        return { kind: "ServiceDeclaration", name, serviceType, target, loc: location };
    }

    // --------------------------------------------------------
    // Workflow block
    // --------------------------------------------------------

    function parseWorkflowBlock(): WorkflowBlock {
        const location = loc();
        expect(TokenType.KEYWORD, "workflow");
        expect(TokenType.COLON);
        expectNewline();

        let trigger: TriggerDeclaration | null = null;
        const body: Statement[] = [];

        if (!match(TokenType.INDENT)) {
            addError(current(), "Expected indented workflow content after \"workflow:\".");
            return { kind: "WorkflowBlock", trigger, body, loc: location };
        }

        while (!check(TokenType.DEDENT) && !atEnd()) {
            skipNewlines();
            if (check(TokenType.DEDENT) || atEnd()) break;

            // Check for trigger
            if (check(TokenType.KEYWORD, "trigger")) {
                trigger = parseTriggerDeclaration();
                continue;
            }

            const stmt = parseStatement();
            if (stmt) body.push(stmt);
            skipNewlines();
        }

        match(TokenType.DEDENT);
        return { kind: "WorkflowBlock", trigger, body, loc: location };
    }

    function parseTriggerDeclaration(): TriggerDeclaration {
        const location = loc();
        expect(TokenType.KEYWORD, "trigger");
        expect(TokenType.COLON);

        // Collect the rest of the line as the trigger description
        let description = "";
        while (!check(TokenType.NEWLINE) && !check(TokenType.DEDENT) && !atEnd()) {
            if (description.length > 0) description += " ";
            description += advance().value;
        }

        expectNewline();
        return { kind: "TriggerDeclaration", description, loc: location };
    }

    // --------------------------------------------------------
    // Statement dispatch
    // --------------------------------------------------------

    function parseStatement(): Statement | null {
        const tok = current();

        try {
            // Named step block
            if (tok.type === TokenType.KEYWORD && tok.value === "step") {
                return parseStepBlock();
            }

            // If / otherwise
            if (tok.type === TokenType.KEYWORD && tok.value === "if") {
                return parseIfStatement();
            }

            // For each
            if (tok.type === TokenType.KEYWORD_COMPOUND && tok.value === "for each") {
                return parseForEachStatement();
            }

            // Set variable
            if (tok.type === TokenType.KEYWORD && tok.value === "set") {
                return parseSetStatement();
            }

            // Ask AI agent
            if (tok.type === TokenType.KEYWORD && tok.value === "ask") {
                return parseAskStatement();
            }

            // Complete
            if (tok.type === TokenType.KEYWORD && tok.value === "complete") {
                return parseCompleteStatement();
            }

            // Reject
            if (tok.type === TokenType.KEYWORD && tok.value === "reject") {
                return parseRejectStatement();
            }

            // Log
            if (tok.type === TokenType.KEYWORD && tok.value === "log") {
                return parseLogStatement();
            }

            // Default: service call (verb + description + using + service)
            if (tok.type === TokenType.IDENTIFIER || tok.type === TokenType.KEYWORD) {
                return parseServiceCall();
            }

            addError(tok, `I don't understand "${tok.value}" here. Expected a statement like "set", "if", "log", "step", etc.`);
            skipToNextStatement();
            skipNewlines();
            return null;
        } catch (e) {
            if (e instanceof ParserError) {
                errors.push(e.flowError);
                skipToNextStatement();
                skipNewlines();
                return null;
            }
            throw e;
        }
    }

    // --------------------------------------------------------
    // Step block
    // --------------------------------------------------------

    function parseStepBlock(): StepBlock {
        const location = loc();
        expect(TokenType.KEYWORD, "step");

        // Collect step name (can be multiple words)
        let name = "";
        while (!check(TokenType.COLON) && !check(TokenType.NEWLINE) && !atEnd()) {
            if (name.length > 0) name += " ";
            name += advance().value;
        }

        if (name.length === 0) {
            addError(current(), "Expected a name for this step.",
                undefined, 'Example: step Verify Email:');
        }

        expect(TokenType.COLON, undefined, "after step name");
        expectNewline();

        const body = parseBlock();

        return { kind: "StepBlock", name, body, loc: location };
    }

    // --------------------------------------------------------
    // If / otherwise if / otherwise
    // --------------------------------------------------------

    function parseIfStatement(): IfStatement {
        const location = loc();
        expect(TokenType.KEYWORD, "if");

        const condition = parseConditionExpression();
        expect(TokenType.COLON, undefined, "after condition");
        expectNewline();

        const body = parseBlock();
        const otherwiseIfs: OtherwiseIf[] = [];
        let otherwise: Statement[] | null = null;

        // Check for "otherwise if" chains
        while (check(TokenType.KEYWORD_COMPOUND, "otherwise if")) {
            const oiLoc = loc();
            advance(); // consume "otherwise if"
            const oiCondition = parseConditionExpression();
            expect(TokenType.COLON, undefined, "after condition");
            expectNewline();
            const oiBody = parseBlock();
            otherwiseIfs.push({ kind: "OtherwiseIf", condition: oiCondition, body: oiBody, loc: oiLoc });
        }

        // Check for "otherwise"
        if (check(TokenType.KEYWORD, "otherwise")) {
            advance();
            expect(TokenType.COLON);
            expectNewline();
            otherwise = parseBlock();
        }

        return { kind: "IfStatement", condition, body, otherwiseIfs, otherwise, loc: location };
    }

    // --------------------------------------------------------
    // For each
    // --------------------------------------------------------

    function parseForEachStatement(): ForEachStatement {
        const location = loc();
        expect(TokenType.KEYWORD_COMPOUND, "for each");

        const itemTok = current();
        if (itemTok.type !== TokenType.IDENTIFIER) {
            addError(itemTok, `Expected a variable name after "for each", but found "${itemTok.value}".`,
                undefined, 'Example: for each item in order.items:');
            skipToNextStatement();
            return { kind: "ForEachStatement", itemName: "_error", collection: makeErrorExpr(), body: [], loc: location };
        }
        const itemName = advance().value;

        expect(TokenType.KEYWORD, "in", "after loop variable name");

        const collection = parseAtomExpression();
        expect(TokenType.COLON, undefined, "after collection");
        expectNewline();

        const body = parseBlock();

        return { kind: "ForEachStatement", itemName, collection, body, loc: location };
    }

    // --------------------------------------------------------
    // Set statement
    // --------------------------------------------------------

    function parseSetStatement(): SetStatement {
        const location = loc();
        expect(TokenType.KEYWORD, "set");

        const varTok = current();
        if (varTok.type !== TokenType.IDENTIFIER && varTok.type !== TokenType.KEYWORD) {
            addError(varTok, `Expected a variable name after "set", but found "${varTok.value}".`,
                undefined, 'Example: set greeting to "Hello"');
        }
        const variable = advance().value;

        expect(TokenType.KEYWORD, "to", "after variable name");

        const value = parseExpression();
        expectNewline();

        return { kind: "SetStatement", variable, value, loc: location };
    }

    // --------------------------------------------------------
    // Ask statement
    // --------------------------------------------------------

    function parseAskStatement(): AskStatement {
        const location = loc();
        expect(TokenType.KEYWORD, "ask");

        const agentTok = current();
        const agent = advance().value;

        expect(TokenType.KEYWORD, "to", "after agent name");

        // Collect the instruction (rest of the line)
        let instruction = "";
        while (!check(TokenType.NEWLINE) && !check(TokenType.DEDENT) && !atEnd()) {
            if (instruction.length > 0) instruction += " ";
            instruction += advance().value;
        }

        expectNewline();

        // Check for indented save directives
        let resultVar: string | null = null;
        let confidenceVar: string | null = null;

        if (match(TokenType.INDENT)) {
            while (!check(TokenType.DEDENT) && !atEnd()) {
                skipNewlines();
                if (check(TokenType.DEDENT) || atEnd()) break;

                if (check(TokenType.KEYWORD_COMPOUND, "save the result as")) {
                    advance();
                    resultVar = advance().value;
                    expectNewline();
                } else if (check(TokenType.KEYWORD_COMPOUND, "save the confidence as")) {
                    advance();
                    confidenceVar = advance().value;
                    expectNewline();
                } else {
                    break;
                }
            }
            match(TokenType.DEDENT);
        }

        return { kind: "AskStatement", agent, instruction, resultVar, confidenceVar, loc: location };
    }

    // --------------------------------------------------------
    // Complete statement
    // --------------------------------------------------------

    function parseCompleteStatement(): CompleteStatement {
        const location = loc();
        expect(TokenType.KEYWORD, "complete");

        const outputs: Parameter[] = [];

        if (match(TokenType.KEYWORD, "with")) {
            // Parse key-value pairs: key expr [and key expr ...]
            do {
                const paramLoc = loc();
                const nameTok = current();
                const name = advance().value;
                const value = parseAtomExpression();
                outputs.push({ kind: "Parameter", name, value, loc: paramLoc });
            } while (match(TokenType.KEYWORD, "and"));
        }

        expectNewline();
        return { kind: "CompleteStatement", outputs, loc: location };
    }

    // --------------------------------------------------------
    // Reject statement
    // --------------------------------------------------------

    function parseRejectStatement(): RejectStatement {
        const location = loc();
        expect(TokenType.KEYWORD, "reject");
        expect(TokenType.KEYWORD, "with", "after \"reject\"");

        const message = parseAtomExpression();
        expectNewline();

        return { kind: "RejectStatement", message, loc: location };
    }

    // --------------------------------------------------------
    // Log statement
    // --------------------------------------------------------

    function parseLogStatement(): LogStatement {
        const location = loc();
        expect(TokenType.KEYWORD, "log");

        const expression = parseAtomExpression();
        expectNewline();

        return { kind: "LogStatement", expression, loc: location };
    }

    // --------------------------------------------------------
    // Service call (the default catch-all)
    // --------------------------------------------------------

    function parseServiceCall(): ServiceCall {
        const location = loc();

        // verb is the first word
        const verb = advance().value;

        // description: everything up to "using"
        let description = "";
        while (
            !atEnd() &&
            !check(TokenType.NEWLINE) &&
            !check(TokenType.DEDENT) &&
            !(check(TokenType.KEYWORD, "using"))
        ) {
            if (description.length > 0) description += " ";
            description += advance().value;
        }

        let service = "";
        const parameters: Parameter[] = [];

        if (match(TokenType.KEYWORD, "using")) {
            const serviceTok = current();
            service = advance().value;

            // Optional "with" parameters: key expr [and key expr ...]
            // Or "to" target
            if (match(TokenType.KEYWORD, "with")) {
                do {
                    const paramLoc = loc();
                    const name = advance().value;
                    const value = parseAtomExpression();
                    parameters.push({ kind: "Parameter", name, value, loc: paramLoc });
                } while (match(TokenType.KEYWORD, "and"));
            } else if (match(TokenType.KEYWORD, "to")) {
                const paramLoc = loc();
                const value = parseAtomExpression();
                parameters.push({ kind: "Parameter", name: "to", value, loc: paramLoc });
            }
        }

        expectNewline();

        // Check for error handler block
        let errorHandler: ErrorHandler | null = null;
        if (match(TokenType.INDENT)) {
            if (check(TokenType.KEYWORD_COMPOUND, "on failure") || check(TokenType.KEYWORD_COMPOUND, "on timeout")) {
                errorHandler = parseErrorHandler();
            }
            // If there was an INDENT but no error handler, it might be wrong — handle gracefully
            if (!errorHandler) {
                // Skip any remaining content in this indented block
                while (!check(TokenType.DEDENT) && !atEnd()) {
                    advance();
                }
            }
            match(TokenType.DEDENT);
        }

        return { kind: "ServiceCall", verb, description, service, parameters, errorHandler, loc: location };
    }

    // --------------------------------------------------------
    // Error handler
    // --------------------------------------------------------

    function parseErrorHandler(): ErrorHandler {
        const location = loc();

        // consume "on failure:" or "on timeout:"
        advance();
        expect(TokenType.COLON);
        expectNewline();

        let retryCount: number | null = null;
        let retryWaitSeconds: number | null = null;
        let fallback: Statement[] | null = null;

        if (!match(TokenType.INDENT)) {
            return { kind: "ErrorHandler", retryCount, retryWaitSeconds, fallback, loc: location };
        }

        while (!check(TokenType.DEDENT) && !atEnd()) {
            skipNewlines();
            if (check(TokenType.DEDENT) || atEnd()) break;

            // "retry N times waiting N seconds"
            if (check(TokenType.KEYWORD, "retry")) {
                advance(); // consume "retry"
                const countTok = current();
                if (countTok.type === TokenType.NUMBER) {
                    retryCount = Number(advance().value);
                }
                match(TokenType.KEYWORD, "times");

                if (match(TokenType.KEYWORD, "waiting")) {
                    const waitTok = current();
                    if (waitTok.type === TokenType.NUMBER) {
                        retryWaitSeconds = Number(advance().value);
                    }
                    // consume "seconds" or "minutes" as identifier
                    if (check(TokenType.IDENTIFIER) || check(TokenType.KEYWORD)) {
                        const unitTok = advance();
                        if (unitTok.value === "minutes") {
                            retryWaitSeconds = (retryWaitSeconds ?? 0) * 60;
                        }
                    }
                }
                expectNewline();
            }
            // "if still failing:"
            else if (check(TokenType.KEYWORD_COMPOUND, "if still failing")) {
                advance();
                expect(TokenType.COLON);
                expectNewline();
                fallback = parseBlock();
            } else {
                // Unknown content in error handler — skip line
                skipToNextStatement();
                skipNewlines();
            }
        }

        match(TokenType.DEDENT);
        return { kind: "ErrorHandler", retryCount, retryWaitSeconds, fallback, loc: location };
    }

    // --------------------------------------------------------
    // Block parsing (indented block of statements)
    // --------------------------------------------------------

    function parseBlock(): Statement[] {
        const statements: Statement[] = [];

        if (!match(TokenType.INDENT)) {
            addError(current(), "Expected an indented block here.");
            return statements;
        }

        while (!check(TokenType.DEDENT) && !atEnd()) {
            skipNewlines();
            if (check(TokenType.DEDENT) || atEnd()) break;

            const stmt = parseStatement();
            if (stmt) statements.push(stmt);
            skipNewlines();
        }

        match(TokenType.DEDENT);
        return statements;
    }

    // --------------------------------------------------------
    // Expression parsing
    // --------------------------------------------------------

    function parseExpression(): Expression {
        return parseLogicalExpression();
    }

    function parseLogicalExpression(): Expression {
        let left = parseComparisonOrMathExpression();

        while (check(TokenType.KEYWORD, "and") || check(TokenType.KEYWORD, "or")) {
            const op = advance().value as "and" | "or";
            const right = parseComparisonOrMathExpression();
            left = {
                kind: "LogicalExpression",
                operator: op,
                left,
                right,
                loc: left.loc,
            };
        }

        return left;
    }

    function parseComparisonOrMathExpression(): Expression {
        let left = parseAtomExpression();

        // Check for comparison operator
        const tok = current();
        const compoundValue = tok.type === TokenType.KEYWORD_COMPOUND ? tok.value : null;
        const singleValue = tok.type === TokenType.KEYWORD ? tok.value : null;
        const opValue = compoundValue ?? singleValue;

        if (opValue && COMPARISON_OPERATORS.has(opValue)) {
            advance();
            const operator = opValue as ComparisonOperator;

            if (UNARY_COMPARISON_OPERATORS.has(opValue)) {
                return {
                    kind: "ComparisonExpression",
                    left,
                    operator,
                    right: null,
                    loc: left.loc,
                };
            }

            const right = parseAtomExpression();
            return {
                kind: "ComparisonExpression",
                left,
                operator,
                right,
                loc: left.loc,
            };
        }

        // Check for math operator
        if (opValue && MATH_OPERATORS.has(opValue)) {
            advance();
            const operator = opValue as MathOperator;
            const right = parseAtomExpression();
            left = {
                kind: "MathExpression",
                left,
                operator,
                right,
                loc: left.loc,
            };

            // Allow chaining: a plus b minus c
            while (true) {
                const nextTok = current();
                const nextOp = nextTok.type === TokenType.KEYWORD_COMPOUND
                    ? nextTok.value
                    : nextTok.type === TokenType.KEYWORD
                        ? nextTok.value
                        : null;
                if (nextOp && MATH_OPERATORS.has(nextOp)) {
                    advance();
                    const chainRight = parseAtomExpression();
                    left = {
                        kind: "MathExpression",
                        left,
                        operator: nextOp as MathOperator,
                        right: chainRight,
                        loc: left.loc,
                    };
                } else {
                    break;
                }
            }
        }

        return left;
    }

    function parseAtomExpression(): Expression {
        const tok = current();

        // String literal
        if (tok.type === TokenType.STRING) {
            advance();
            return { kind: "StringLiteral", value: tok.value, loc: { line: tok.line, column: tok.column } };
        }

        // Interpolated string (starts with STRING_PART)
        if (tok.type === TokenType.STRING_PART) {
            return parseInterpolatedString();
        }

        // Number literal
        if (tok.type === TokenType.NUMBER) {
            advance();
            return { kind: "NumberLiteral", value: Number(tok.value), loc: { line: tok.line, column: tok.column } };
        }

        // Boolean literal
        if (tok.type === TokenType.BOOLEAN) {
            advance();
            return { kind: "BooleanLiteral", value: tok.value === "true", loc: { line: tok.line, column: tok.column } };
        }

        // Identifier (possibly with dot access)
        if (tok.type === TokenType.IDENTIFIER) {
            return parseIdentifierOrDotAccess();
        }

        // Keyword used as identifier in expression context (e.g., "status" as a key name)
        if (tok.type === TokenType.KEYWORD && !isStatementKeyword(tok.value)) {
            advance();
            let expr: Expression = { kind: "Identifier", name: tok.value, loc: { line: tok.line, column: tok.column } };

            // Handle dot access
            while (check(TokenType.DOT)) {
                advance();
                const propTok = current();
                const prop = advance().value;
                expr = { kind: "DotAccess", object: expr, property: prop, loc: expr.loc };
            }
            return expr;
        }

        // env keyword (env.VAR_NAME)
        if (tok.type === TokenType.KEYWORD && tok.value === "env") {
            advance();
            let expr: Expression = { kind: "Identifier", name: "env", loc: { line: tok.line, column: tok.column } };
            while (check(TokenType.DOT)) {
                advance();
                const propTok = current();
                const prop = advance().value;
                expr = { kind: "DotAccess", object: expr, property: prop, loc: expr.loc };
            }
            return expr;
        }

        addError(tok, `Expected a value (string, number, or variable name), but found "${tok.value}".`);
        advance();
        return makeErrorExpr();
    }

    function parseIdentifierOrDotAccess(): Expression {
        const tok = advance();
        let expr: Expression = { kind: "Identifier", name: tok.value, loc: { line: tok.line, column: tok.column } };

        while (check(TokenType.DOT)) {
            advance(); // consume dot
            const propTok = current();
            if (propTok.type !== TokenType.IDENTIFIER && propTok.type !== TokenType.KEYWORD) {
                addError(propTok, `Expected a property name after ".", but found "${propTok.value}".`);
                break;
            }
            const prop = advance().value;
            expr = { kind: "DotAccess", object: expr, property: prop, loc: expr.loc };
        }

        return expr;
    }

    function parseInterpolatedString(): InterpolatedString {
        const location = loc();
        const parts: InterpolationPart[] = [];

        while (check(TokenType.STRING_PART)) {
            const textTok = advance();
            if (textTok.value.length > 0) {
                parts.push({ kind: "text", value: textTok.value });
            }

            if (match(TokenType.INTERP_START)) {
                const expr = parseIdentifierOrDotAccess();
                parts.push({ kind: "expression", value: expr });
                expect(TokenType.INTERP_END);
            }
        }

        // Handle trailing empty STRING_PART
        if (parts.length === 0) {
            parts.push({ kind: "text", value: "" });
        }

        return { kind: "InterpolatedString", parts, loc: location };
    }

    // --------------------------------------------------------
    // Condition expression (used by if statements)
    // --------------------------------------------------------

    function parseConditionExpression(): Expression {
        // Check for "not" prefix
        if (check(TokenType.KEYWORD, "not")) {
            const notLoc = loc();
            advance();
            const operand = parseConditionExpression();
            return { kind: "LogicalExpression", operator: "not", left: operand, right: null, loc: notLoc };
        }

        return parseExpression();
    }

    // --------------------------------------------------------
    // Helpers
    // --------------------------------------------------------

    function isStatementKeyword(value: string): boolean {
        return ["if", "set", "ask", "step", "complete", "reject", "log", "otherwise", "workflow", "config", "services", "trigger"].includes(value);
    }

    function makeErrorExpr(): Expression {
        return { kind: "StringLiteral", value: "<error>", loc: loc() };
    }

    // --------------------------------------------------------
    // Run the parser
    // --------------------------------------------------------

    const program = parseProgram();
    return { program, errors };
}
