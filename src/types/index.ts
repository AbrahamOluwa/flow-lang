// ============================================================
// Token Types
// ============================================================

export enum TokenType {
    // Structure
    INDENT = "INDENT",
    DEDENT = "DEDENT",
    NEWLINE = "NEWLINE",
    EOF = "EOF",

    // Literals
    STRING = "STRING",
    STRING_PART = "STRING_PART",
    NUMBER = "NUMBER",
    BOOLEAN = "BOOLEAN",

    // Interpolation
    INTERP_START = "INTERP_START",
    INTERP_END = "INTERP_END",

    // Identifiers
    IDENTIFIER = "IDENTIFIER",

    // Keywords (single-word)
    KEYWORD = "KEYWORD",

    // Keywords (multi-word like "is above", "for each")
    KEYWORD_COMPOUND = "KEYWORD_COMPOUND",

    // Symbols
    COLON = "COLON",
    DOT = "DOT",
}

export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
}

// ============================================================
// AST Node Types
// ============================================================

export interface SourceLocation {
    line: number;
    column: number;
}

// --- Top-level ---

export interface Program {
    kind: "Program";
    config: ConfigBlock | null;
    services: ServicesBlock | null;
    workflow: WorkflowBlock | null;
    loc: SourceLocation;
}

// --- Config ---

export interface ConfigBlock {
    kind: "ConfigBlock";
    entries: ConfigEntry[];
    loc: SourceLocation;
}

export interface ConfigEntry {
    kind: "ConfigEntry";
    key: string;
    value: string | number;
    loc: SourceLocation;
}

// --- Services ---

export interface ServicesBlock {
    kind: "ServicesBlock";
    declarations: ServiceDeclaration[];
    loc: SourceLocation;
}

export type ServiceType = "api" | "ai" | "plugin" | "webhook";

export interface ServiceHeader {
    name: string;
    value: Expression;
    loc: SourceLocation;
}

export interface ServiceDeclaration {
    kind: "ServiceDeclaration";
    name: string;
    serviceType: ServiceType;
    target: string;
    headers: ServiceHeader[];
    loc: SourceLocation;
}

// --- Workflow ---

export interface WorkflowBlock {
    kind: "WorkflowBlock";
    trigger: TriggerDeclaration | null;
    body: Statement[];
    loc: SourceLocation;
}

export interface TriggerDeclaration {
    kind: "TriggerDeclaration";
    description: string;
    loc: SourceLocation;
}

// --- Statements ---

export type Statement =
    | StepBlock
    | ServiceCall
    | AskStatement
    | SetStatement
    | IfStatement
    | ForEachStatement
    | LogStatement
    | CompleteStatement
    | RejectStatement;

export interface StepBlock {
    kind: "StepBlock";
    name: string;
    body: Statement[];
    loc: SourceLocation;
}

export interface ServiceCall {
    kind: "ServiceCall";
    verb: string;
    description: string;
    service: string;
    path: Expression | null;
    parameters: Parameter[];
    resultVar: string | null;
    statusVar: string | null;
    headersVar: string | null;
    errorHandler: ErrorHandler | null;
    loc: SourceLocation;
}

export interface Parameter {
    kind: "Parameter";
    name: string;
    value: Expression;
    loc: SourceLocation;
}

export interface AskStatement {
    kind: "AskStatement";
    agent: string;
    instruction: string;
    resultVar: string | null;
    confidenceVar: string | null;
    loc: SourceLocation;
}

export interface SetStatement {
    kind: "SetStatement";
    variable: string;
    value: Expression;
    loc: SourceLocation;
}

export interface IfStatement {
    kind: "IfStatement";
    condition: Expression;
    body: Statement[];
    otherwiseIfs: OtherwiseIf[];
    otherwise: Statement[] | null;
    loc: SourceLocation;
}

export interface OtherwiseIf {
    kind: "OtherwiseIf";
    condition: Expression;
    body: Statement[];
    loc: SourceLocation;
}

export interface ForEachStatement {
    kind: "ForEachStatement";
    itemName: string;
    collection: Expression;
    body: Statement[];
    loc: SourceLocation;
}

export interface LogStatement {
    kind: "LogStatement";
    expression: Expression;
    loc: SourceLocation;
}

export interface CompleteStatement {
    kind: "CompleteStatement";
    outputs: Parameter[];
    loc: SourceLocation;
}

export interface RejectStatement {
    kind: "RejectStatement";
    message: Expression;
    loc: SourceLocation;
}

// --- Error Handling ---

export interface ErrorHandler {
    kind: "ErrorHandler";
    retryCount: number | null;
    retryWaitSeconds: number | null;
    fallback: Statement[] | null;
    loc: SourceLocation;
}

// --- Expressions ---

export type Expression =
    | StringLiteral
    | InterpolatedString
    | NumberLiteral
    | BooleanLiteral
    | Identifier
    | DotAccess
    | MathExpression
    | ComparisonExpression
    | LogicalExpression;

export interface StringLiteral {
    kind: "StringLiteral";
    value: string;
    loc: SourceLocation;
}

export interface InterpolatedString {
    kind: "InterpolatedString";
    parts: InterpolationPart[];
    loc: SourceLocation;
}

export type InterpolationPart =
    | { kind: "text"; value: string }
    | { kind: "expression"; value: Expression };

export interface NumberLiteral {
    kind: "NumberLiteral";
    value: number;
    loc: SourceLocation;
}

export interface BooleanLiteral {
    kind: "BooleanLiteral";
    value: boolean;
    loc: SourceLocation;
}

export interface Identifier {
    kind: "Identifier";
    name: string;
    loc: SourceLocation;
}

export interface DotAccess {
    kind: "DotAccess";
    object: Expression;
    property: string;
    loc: SourceLocation;
}

export type MathOperator = "plus" | "minus" | "times" | "divided by" | "rounded to";

export interface MathExpression {
    kind: "MathExpression";
    left: Expression;
    operator: MathOperator;
    right: Expression;
    loc: SourceLocation;
}

export type ComparisonOperator =
    | "is"
    | "is not"
    | "is above"
    | "is below"
    | "is at least"
    | "is at most"
    | "contains"
    | "is empty"
    | "is not empty"
    | "exists"
    | "does not exist";

export interface ComparisonExpression {
    kind: "ComparisonExpression";
    left: Expression;
    operator: ComparisonOperator;
    right: Expression | null; // null for unary ops like "is empty"
    loc: SourceLocation;
}

export type LogicalOperator = "and" | "or" | "not";

export interface LogicalExpression {
    kind: "LogicalExpression";
    operator: LogicalOperator;
    left: Expression;
    right: Expression | null; // null for unary "not"
    loc: SourceLocation;
}

// ============================================================
// Runtime Values
// ============================================================

export type FlowValue =
    | FlowText
    | FlowNumber
    | FlowBoolean
    | FlowList
    | FlowRecord
    | FlowEmpty;

export interface FlowText {
    type: "text";
    value: string;
}

export interface FlowNumber {
    type: "number";
    value: number;
}

export interface FlowBoolean {
    type: "boolean";
    value: boolean;
}

export interface FlowList {
    type: "list";
    value: FlowValue[];
}

export interface FlowRecord {
    type: "record";
    value: Map<string, FlowValue>;
}

export interface FlowEmpty {
    type: "empty";
}

// ============================================================
// Errors
// ============================================================

export type ErrorSeverity = "error" | "warning";

export interface FlowError {
    severity: ErrorSeverity;
    file: string;
    line: number;
    column: number;
    message: string;
    sourceLine: string;
    suggestion: string | null;
    hint: string | null;
}

// ============================================================
// Execution Result
// ============================================================

export type WorkflowResult =
    | { status: "completed"; outputs: Record<string, FlowValue> }
    | { status: "rejected"; message: string }
    | { status: "error"; error: FlowError };

export interface LogEntry {
    timestamp: Date;
    step: string | null;
    action: string;
    result: "success" | "failure" | "skipped";
    details: Record<string, unknown>;
}

export interface ExecutionResult {
    result: WorkflowResult;
    log: LogEntry[];
}
