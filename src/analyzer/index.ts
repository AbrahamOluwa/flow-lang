import {
    Program, FlowError, Statement, Expression,
    ServiceCall, AskStatement, SetStatement, IfStatement,
    ForEachStatement, LogStatement, CompleteStatement, RejectStatement,
    StepBlock, ErrorHandler, Parameter,
    InterpolatedString, DotAccess, MathExpression,
    ComparisonExpression, LogicalExpression,
    SourceLocation,
} from "../types/index.js";
import { createError, findClosestMatch } from "../errors/index.js";

// ============================================================
// Analyzer
// ============================================================

export function analyze(program: Program, source: string, fileName: string = "<input>"): FlowError[] {
    const errors: FlowError[] = [];

    // Collect declared service names
    const declaredServices = new Set<string>();
    if (program.services) {
        for (const decl of program.services.declarations) {
            declaredServices.add(decl.name);
        }
    }
    const serviceNames = [...declaredServices];

    // Collect declared config keys
    const declaredConfigKeys = new Set<string>();

    // Track step names for duplicate detection
    const declaredSteps = new Set<string>();

    // Known config keys
    const knownConfigKeys = new Set(["name", "version", "timeout", "description"]);

    // --------------------------------------------------------
    // Scope for variable tracking
    // --------------------------------------------------------

    interface Scope {
        variables: Set<string>;
        parent: Scope | null;
    }

    function createScope(parent: Scope | null): Scope {
        return { variables: new Set(), parent };
    }

    function defineVar(scope: Scope, name: string): void {
        scope.variables.add(name);
    }

    function isVarDefined(scope: Scope, name: string): boolean {
        let current: Scope | null = scope;
        while (current) {
            if (current.variables.has(name)) return true;
            current = current.parent;
        }
        return false;
    }

    function allDefinedVars(scope: Scope): string[] {
        const vars: string[] = [];
        let current: Scope | null = scope;
        while (current) {
            for (const v of current.variables) {
                vars.push(v);
            }
            current = current.parent;
        }
        return vars;
    }

    // --------------------------------------------------------
    // Error helpers
    // --------------------------------------------------------

    function addError(loc: SourceLocation, message: string, suggestion?: string, hint?: string): void {
        errors.push(createError(fileName, loc.line, loc.column, message, source, { suggestion, hint }));
    }

    function addWarning(loc: SourceLocation, message: string, suggestion?: string, hint?: string): void {
        errors.push(createError(fileName, loc.line, loc.column, message, source, { suggestion, hint, severity: "warning" }));
    }

    // --------------------------------------------------------
    // Config validation
    // --------------------------------------------------------

    function analyzeConfig(): void {
        if (!program.config) return;

        for (const entry of program.config.entries) {
            // Duplicate config keys
            if (declaredConfigKeys.has(entry.key)) {
                addError(entry.loc,
                    `Duplicate config key "${entry.key}". Each config key can only appear once.`);
            }
            declaredConfigKeys.add(entry.key);

            // Unknown config keys
            if (!knownConfigKeys.has(entry.key)) {
                addWarning(entry.loc,
                    `Unknown config key "${entry.key}".`,
                    undefined,
                    `Known config keys are: ${[...knownConfigKeys].join(", ")}`);
            }
        }
    }

    // --------------------------------------------------------
    // Services validation
    // --------------------------------------------------------

    function analyzeServices(): void {
        if (!program.services) return;

        const seen = new Set<string>();
        for (const decl of program.services.declarations) {
            if (seen.has(decl.name)) {
                addError(decl.loc,
                    `Duplicate service name "${decl.name}". Each service must have a unique name.`);
            }
            seen.add(decl.name);

            // Validate headers
            if (decl.headers.length > 0) {
                if (decl.serviceType === "ai" || decl.serviceType === "plugin") {
                    addWarning(decl.headers[0]!.loc,
                        `Headers are not supported on ${decl.serviceType} services. They will be ignored.`,
                        `Remove the "with headers:" block from "${decl.name}".`);
                }

                const seenHeaders = new Set<string>();
                for (const header of decl.headers) {
                    const lowerName = header.name.toLowerCase();
                    if (seenHeaders.has(lowerName)) {
                        addWarning(header.loc,
                            `Duplicate header "${header.name}" on service "${decl.name}". The last value will be used.`);
                    }
                    seenHeaders.add(lowerName);
                }
            }
        }
    }

    // --------------------------------------------------------
    // Check service references
    // --------------------------------------------------------

    function checkServiceRef(name: string, loc: SourceLocation): void {
        if (name === "") return; // skip empty (parse error artifact)
        if (declaredServices.has(name)) return;

        const suggestion = findClosestMatch(name, serviceNames);
        addError(loc,
            `I don't know what "${name}" is. You haven't declared it in your services block.`,
            suggestion ? `Did you mean "${suggestion}"?` : undefined,
            `Every service must be declared at the top of your file:\n    services:\n        ${name} is an API at "https://..."`);
    }

    // --------------------------------------------------------
    // Check variable references in expressions
    // --------------------------------------------------------

    function checkExpression(expr: Expression, scope: Scope): void {
        switch (expr.kind) {
            case "Identifier":
                if (!isVarDefined(scope, expr.name)) {
                    const suggestion = findClosestMatch(expr.name, allDefinedVars(scope));
                    addError(expr.loc,
                        `I don't recognize the variable "${expr.name}". It hasn't been set yet.`,
                        suggestion ? `Did you mean "${suggestion}"?` : undefined,
                        'Variables must be created with "set" before they can be used:\n    set ' + expr.name + ' to ...');
                }
                break;

            case "DotAccess":
                checkDotAccessRoot(expr, scope);
                break;

            case "InterpolatedString":
                for (const part of expr.parts) {
                    if (part.kind === "expression") {
                        checkExpression(part.value, scope);
                    }
                }
                break;

            case "MathExpression":
                checkExpression(expr.left, scope);
                checkExpression(expr.right, scope);
                break;

            case "ComparisonExpression":
                checkExpression(expr.left, scope);
                if (expr.right) checkExpression(expr.right, scope);
                break;

            case "LogicalExpression":
                checkExpression(expr.left, scope);
                if (expr.right) checkExpression(expr.right, scope);
                break;

            case "StringLiteral":
            case "NumberLiteral":
            case "BooleanLiteral":
                // No variables to check
                break;
        }
    }

    /**
     * Dot-access roots (e.g., `signup` in `signup.email`) are treated as
     * potentially implicit external data (trigger payload, service response).
     * We don't flag them as undefined — only standalone Identifier expressions
     * are checked strictly.
     */
    function checkDotAccessRoot(_expr: Expression, _scope: Scope): void {
        // Intentionally lenient: dot-access roots may be implicit trigger/service data.
    }

    // --------------------------------------------------------
    // Statement analysis
    // --------------------------------------------------------

    function analyzeStatements(stmts: Statement[], scope: Scope): void {
        for (const stmt of stmts) {
            analyzeStatement(stmt, scope);
        }
    }

    function analyzeStatement(stmt: Statement, scope: Scope): void {
        switch (stmt.kind) {
            case "SetStatement":
                analyzeSetStatement(stmt, scope);
                break;
            case "IfStatement":
                analyzeIfStatement(stmt, scope);
                break;
            case "ForEachStatement":
                analyzeForEachStatement(stmt, scope);
                break;
            case "ServiceCall":
                analyzeServiceCall(stmt, scope);
                break;
            case "AskStatement":
                analyzeAskStatement(stmt, scope);
                break;
            case "LogStatement":
                checkExpression(stmt.expression, scope);
                break;
            case "CompleteStatement":
                analyzeCompleteStatement(stmt, scope);
                break;
            case "RejectStatement":
                checkExpression(stmt.message, scope);
                break;
            case "StepBlock":
                analyzeStepBlock(stmt, scope);
                break;
        }
    }

    function analyzeSetStatement(stmt: SetStatement, scope: Scope): void {
        // Check the value expression first (before the variable is defined)
        checkExpression(stmt.value, scope);
        // Then define the variable
        defineVar(scope, stmt.variable);
    }

    function analyzeIfStatement(stmt: IfStatement, scope: Scope): void {
        checkExpression(stmt.condition, scope);
        analyzeStatements(stmt.body, scope);

        for (const oi of stmt.otherwiseIfs) {
            checkExpression(oi.condition, scope);
            analyzeStatements(oi.body, scope);
        }

        if (stmt.otherwise) {
            analyzeStatements(stmt.otherwise, scope);
        }
    }

    function analyzeForEachStatement(stmt: ForEachStatement, scope: Scope): void {
        checkExpression(stmt.collection, scope);

        // Loop variable is scoped to the loop body
        const loopScope = createScope(scope);
        defineVar(loopScope, stmt.itemName);
        analyzeStatements(stmt.body, loopScope);
    }

    function analyzeServiceCall(stmt: ServiceCall, scope: Scope): void {
        if (stmt.service) {
            checkServiceRef(stmt.service, stmt.loc);
        }
        for (const param of stmt.parameters) {
            checkExpression(param.value, scope);
        }
        if (stmt.path) {
            checkExpression(stmt.path, scope);
        }
        if (stmt.resultVar) {
            defineVar(scope, stmt.resultVar);
        }
        if (stmt.statusVar) {
            defineVar(scope, stmt.statusVar);
        }
        if (stmt.headersVar) {
            defineVar(scope, stmt.headersVar);
        }
        if (stmt.errorHandler) {
            analyzeErrorHandler(stmt.errorHandler, scope);
        }
    }

    function analyzeAskStatement(stmt: AskStatement, scope: Scope): void {
        checkServiceRef(stmt.agent, stmt.loc);

        // save the result as / save the confidence as define variables
        if (stmt.resultVar) {
            defineVar(scope, stmt.resultVar);
        }
        if (stmt.confidenceVar) {
            defineVar(scope, stmt.confidenceVar);
        }
    }

    function analyzeCompleteStatement(stmt: CompleteStatement, scope: Scope): void {
        for (const param of stmt.outputs) {
            checkExpression(param.value, scope);
        }
    }

    function analyzeStepBlock(stmt: StepBlock, scope: Scope): void {
        if (declaredSteps.has(stmt.name)) {
            addError(stmt.loc,
                `Duplicate step name "${stmt.name}". Each step must have a unique name.`,
                "Rename one of the steps to something different.");
        }
        declaredSteps.add(stmt.name);

        // Steps do NOT create a new scope — they are organizational only
        analyzeStatements(stmt.body, scope);
    }

    function analyzeErrorHandler(handler: ErrorHandler, scope: Scope): void {
        if (handler.fallback) {
            analyzeStatements(handler.fallback, scope);
        }
    }

    // --------------------------------------------------------
    // Main analysis
    // --------------------------------------------------------

    analyzeConfig();
    analyzeServices();

    if (program.workflow) {
        const globalScope = createScope(null);

        // Trigger data is implicitly available (users access it via dot notation)
        // We don't know the exact shape, so we treat any root-level identifier
        // referenced via dot access as potentially valid trigger data.
        // But we do need to make "env" available.
        defineVar(globalScope, "env");

        analyzeStatements(program.workflow.body, globalScope);
    }

    return errors;
}
