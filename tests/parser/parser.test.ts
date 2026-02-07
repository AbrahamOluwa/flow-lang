import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import type {
    Program, Statement, Expression,
    SetStatement, IfStatement, ForEachStatement,
    LogStatement, CompleteStatement, RejectStatement,
    ServiceCall, AskStatement, StepBlock,
    MathExpression, ComparisonExpression, DotAccess,
    InterpolatedString, LogicalExpression,
} from "../../src/types/index.js";

// Helper: parse a source string and return the Program
function p(source: string): Program {
    const tokens = tokenize(source);
    const result = parse(tokens, source);
    return result.program;
}

// Helper: parse and expect zero errors
function pOk(source: string) {
    const tokens = tokenize(source);
    const result = parse(tokens, source);
    expect(result.errors, `Parse errors: ${result.errors.map(e => e.message).join("; ")}`).toHaveLength(0);
    return result.program;
}

// Helper: parse and return errors
function pErrors(source: string) {
    const tokens = tokenize(source);
    const result = parse(tokens, source);
    return result.errors;
}

// Helper: get workflow body from source
function stmts(source: string): Statement[] {
    const program = pOk(source);
    return program.workflow?.body ?? [];
}

// Helper: get the first workflow statement
function firstStmt(source: string): Statement {
    const body = stmts(source);
    expect(body.length).toBeGreaterThan(0);
    return body[0]!;
}

// ============================================================
// Empty / minimal programs
// ============================================================

describe("Parser — minimal programs", () => {
    it("parses an empty file", () => {
        const program = pOk("");
        expect(program.kind).toBe("Program");
        expect(program.config).toBeNull();
        expect(program.services).toBeNull();
        expect(program.workflow).toBeNull();
    });

    it("parses a file with only config", () => {
        const program = pOk('config:\n    name: "Test"');
        expect(program.config).not.toBeNull();
        expect(program.config!.entries).toHaveLength(1);
        expect(program.config!.entries[0]!.key).toBe("name");
        expect(program.config!.entries[0]!.value).toBe("Test");
    });

    it("parses a file with only services", () => {
        const program = pOk('services:\n    Stripe is a plugin "flow-connector-stripe"');
        expect(program.services).not.toBeNull();
        expect(program.services!.declarations).toHaveLength(1);
    });

    it("parses a file with only workflow", () => {
        const program = pOk('workflow:\n    log "hello"');
        expect(program.workflow).not.toBeNull();
        expect(program.workflow!.body).toHaveLength(1);
    });
});

// ============================================================
// Config block
// ============================================================

describe("Parser — config block", () => {
    it("parses string config values", () => {
        const program = pOk('config:\n    name: "My Workflow"');
        expect(program.config!.entries[0]!.value).toBe("My Workflow");
    });

    it("parses numeric config values", () => {
        const program = pOk("config:\n    version: 1");
        expect(program.config!.entries[0]!.value).toBe(1);
    });

    it("parses text config values (like timeout)", () => {
        const program = pOk("config:\n    timeout: 5 minutes");
        expect(program.config!.entries[0]!.key).toBe("timeout");
        expect(program.config!.entries[0]!.value).toBe("5 minutes");
    });

    it("parses multiple config entries", () => {
        const source = [
            "config:",
            '    name: "Test"',
            "    version: 1",
            "    timeout: 5 minutes",
        ].join("\n");
        const program = pOk(source);
        expect(program.config!.entries).toHaveLength(3);
    });

    it("records line numbers on config entries", () => {
        const source = 'config:\n    name: "Test"';
        const program = pOk(source);
        expect(program.config!.entries[0]!.loc.line).toBe(2);
    });
});

// ============================================================
// Services block
// ============================================================

describe("Parser — services block", () => {
    it("parses an API service", () => {
        const program = pOk('services:\n    EmailVerifier is an API at "https://api.example.com/v1"');
        const decl = program.services!.declarations[0]!;
        expect(decl.name).toBe("EmailVerifier");
        expect(decl.serviceType).toBe("api");
        expect(decl.target).toBe("https://api.example.com/v1");
    });

    it("parses an AI service", () => {
        const program = pOk('services:\n    Analyst is an AI using "anthropic/claude-sonnet-4-20250514"');
        const decl = program.services!.declarations[0]!;
        expect(decl.name).toBe("Analyst");
        expect(decl.serviceType).toBe("ai");
        expect(decl.target).toBe("anthropic/claude-sonnet-4-20250514");
    });

    it("parses a plugin service", () => {
        const program = pOk('services:\n    Stripe is a plugin "flow-connector-stripe"');
        const decl = program.services!.declarations[0]!;
        expect(decl.name).toBe("Stripe");
        expect(decl.serviceType).toBe("plugin");
        expect(decl.target).toBe("flow-connector-stripe");
    });

    it("parses a webhook service", () => {
        const program = pOk('services:\n    Incoming is a webhook at "/hooks/incoming"');
        const decl = program.services!.declarations[0]!;
        expect(decl.name).toBe("Incoming");
        expect(decl.serviceType).toBe("webhook");
        expect(decl.target).toBe("/hooks/incoming");
    });

    it("parses multiple services", () => {
        const source = [
            "services:",
            '    EmailVerifier is an API at "https://api.example.com/v1"',
            '    Analyst is an AI using "anthropic/claude-sonnet-4-20250514"',
            '    Stripe is a plugin "flow-connector-stripe"',
        ].join("\n");
        const program = pOk(source);
        expect(program.services!.declarations).toHaveLength(3);
    });

    it("records line numbers on service declarations", () => {
        const source = [
            "services:",
            '    EmailVerifier is an API at "https://api.example.com/v1"',
            '    Stripe is a plugin "flow-connector-stripe"',
        ].join("\n");
        const program = pOk(source);
        expect(program.services!.declarations[0]!.loc.line).toBe(2);
        expect(program.services!.declarations[1]!.loc.line).toBe(3);
    });
});

// ============================================================
// Workflow — trigger
// ============================================================

describe("Parser — trigger", () => {
    it("parses a trigger declaration", () => {
        const source = [
            "workflow:",
            "    trigger: when a form is submitted",
        ].join("\n");
        const program = pOk(source);
        expect(program.workflow!.trigger).not.toBeNull();
        expect(program.workflow!.trigger!.description).toBe("when a form is submitted");
    });
});

// ============================================================
// Set statement
// ============================================================

describe("Parser — set statement", () => {
    it("parses set with a string value", () => {
        const stmt = firstStmt('workflow:\n    set greeting to "Hello"') as SetStatement;
        expect(stmt.kind).toBe("SetStatement");
        expect(stmt.variable).toBe("greeting");
        expect(stmt.value.kind).toBe("StringLiteral");
    });

    it("parses set with a number value", () => {
        const stmt = firstStmt("workflow:\n    set count to 0") as SetStatement;
        expect(stmt.kind).toBe("SetStatement");
        expect(stmt.variable).toBe("count");
        expect(stmt.value.kind).toBe("NumberLiteral");
    });

    it("parses set with a boolean value", () => {
        const stmt = firstStmt("workflow:\n    set active to true") as SetStatement;
        expect(stmt.value.kind).toBe("BooleanLiteral");
    });

    it("parses set with a variable reference", () => {
        const stmt = firstStmt("workflow:\n    set total to subtotal") as SetStatement;
        expect(stmt.value.kind).toBe("Identifier");
    });

    it("parses set with dot access", () => {
        const stmt = firstStmt("workflow:\n    set email to signup.email") as SetStatement;
        expect(stmt.value.kind).toBe("DotAccess");
        const da = stmt.value as DotAccess;
        expect(da.property).toBe("email");
    });

    it("parses set with math expression", () => {
        const stmt = firstStmt("workflow:\n    set total to price times quantity") as SetStatement;
        expect(stmt.value.kind).toBe("MathExpression");
        const math = stmt.value as MathExpression;
        expect(math.operator).toBe("times");
    });

    it("parses set with chained math", () => {
        const stmt = firstStmt("workflow:\n    set total to price plus tax minus discount") as SetStatement;
        expect(stmt.value.kind).toBe("MathExpression");
        const outer = stmt.value as MathExpression;
        expect(outer.operator).toBe("minus");
        expect(outer.left.kind).toBe("MathExpression");
    });

    it("parses set with interpolated string", () => {
        const stmt = firstStmt('workflow:\n    set greeting to "Hello, {name}"') as SetStatement;
        expect(stmt.value.kind).toBe("InterpolatedString");
        const interp = stmt.value as InterpolatedString;
        expect(interp.parts.length).toBeGreaterThan(0);
    });
});

// ============================================================
// If / otherwise if / otherwise
// ============================================================

describe("Parser — if statement", () => {
    it("parses a simple if", () => {
        const source = [
            "workflow:",
            "    if active is true:",
            '        log "active"',
        ].join("\n");
        const stmt = firstStmt(source) as IfStatement;
        expect(stmt.kind).toBe("IfStatement");
        expect(stmt.body).toHaveLength(1);
        expect(stmt.otherwiseIfs).toHaveLength(0);
        expect(stmt.otherwise).toBeNull();
    });

    it("parses if with otherwise", () => {
        const source = [
            "workflow:",
            "    if active is true:",
            '        log "yes"',
            "    otherwise:",
            '        log "no"',
        ].join("\n");
        const stmt = firstStmt(source) as IfStatement;
        expect(stmt.otherwise).not.toBeNull();
        expect(stmt.otherwise).toHaveLength(1);
    });

    it("parses if with otherwise if chain", () => {
        const source = [
            "workflow:",
            "    if score is above 90:",
            '        log "A"',
            "    otherwise if score is above 80:",
            '        log "B"',
            "    otherwise if score is above 70:",
            '        log "C"',
            "    otherwise:",
            '        log "F"',
        ].join("\n");
        const stmt = firstStmt(source) as IfStatement;
        expect(stmt.otherwiseIfs).toHaveLength(2);
        expect(stmt.otherwise).toHaveLength(1);
    });

    it("parses comparison operators in conditions", () => {
        const operators = [
            { source: "score is 100", op: "is" },
            { source: "score is not 0", op: "is not" },
            { source: "score is above 50", op: "is above" },
            { source: "score is below 50", op: "is below" },
            { source: "score is at least 50", op: "is at least" },
            { source: "score is at most 50", op: "is at most" },
            { source: 'name contains "test"', op: "contains" },
        ];

        for (const { source: condSource, op } of operators) {
            const source = `workflow:\n    if ${condSource}:\n        log "x"`;
            const stmt = firstStmt(source) as IfStatement;
            const cond = stmt.condition as ComparisonExpression;
            expect(cond.kind).toBe("ComparisonExpression");
            expect(cond.operator).toBe(op);
        }
    });

    it("parses unary comparison operators", () => {
        const unary = [
            { source: "email is empty", op: "is empty" },
            { source: "email is not empty", op: "is not empty" },
            { source: "result exists", op: "exists" },
            { source: "result does not exist", op: "does not exist" },
        ];

        for (const { source: condSource, op } of unary) {
            const source = `workflow:\n    if ${condSource}:\n        log "x"`;
            const stmt = firstStmt(source) as IfStatement;
            const cond = stmt.condition as ComparisonExpression;
            expect(cond.kind).toBe("ComparisonExpression");
            expect(cond.operator).toBe(op);
            expect(cond.right).toBeNull();
        }
    });

    it("parses logical AND in conditions", () => {
        const source = [
            "workflow:",
            "    if active is true and score is above 50:",
            '        log "ok"',
        ].join("\n");
        const stmt = firstStmt(source) as IfStatement;
        expect(stmt.condition.kind).toBe("LogicalExpression");
        const logical = stmt.condition as LogicalExpression;
        expect(logical.operator).toBe("and");
    });

    it("parses logical OR in conditions", () => {
        const source = [
            "workflow:",
            "    if active is true or override is true:",
            '        log "ok"',
        ].join("\n");
        const stmt = firstStmt(source) as IfStatement;
        const logical = stmt.condition as LogicalExpression;
        expect(logical.operator).toBe("or");
    });
});

// ============================================================
// For each
// ============================================================

describe("Parser — for each", () => {
    it("parses a for each loop", () => {
        const source = [
            "workflow:",
            "    for each item in order.items:",
            '        log "processing"',
        ].join("\n");
        const stmt = firstStmt(source) as ForEachStatement;
        expect(stmt.kind).toBe("ForEachStatement");
        expect(stmt.itemName).toBe("item");
        expect(stmt.collection.kind).toBe("DotAccess");
        expect(stmt.body).toHaveLength(1);
    });

    it("parses for each with simple identifier collection", () => {
        const source = [
            "workflow:",
            "    for each person in people:",
            '        log "hi"',
        ].join("\n");
        const stmt = firstStmt(source) as ForEachStatement;
        expect(stmt.collection.kind).toBe("Identifier");
    });
});

// ============================================================
// Ask statement
// ============================================================

describe("Parser — ask statement", () => {
    it("parses a simple ask", () => {
        const source = [
            "workflow:",
            "    ask Analyst to summarize the report",
        ].join("\n");
        const stmt = firstStmt(source) as AskStatement;
        expect(stmt.kind).toBe("AskStatement");
        expect(stmt.agent).toBe("Analyst");
        expect(stmt.instruction).toBe("summarize the report");
        expect(stmt.resultVar).toBeNull();
        expect(stmt.confidenceVar).toBeNull();
    });

    it("parses ask with save result", () => {
        const source = [
            "workflow:",
            "    ask Analyst to summarize the report",
            "        save the result as summary",
        ].join("\n");
        const stmt = firstStmt(source) as AskStatement;
        expect(stmt.resultVar).toBe("summary");
    });

    it("parses ask with save result and confidence", () => {
        const source = [
            "workflow:",
            "    ask Analyst to summarize the report",
            "        save the result as summary",
            "        save the confidence as confidence_score",
        ].join("\n");
        const stmt = firstStmt(source) as AskStatement;
        expect(stmt.resultVar).toBe("summary");
        expect(stmt.confidenceVar).toBe("confidence_score");
    });
});

// ============================================================
// Log statement
// ============================================================

describe("Parser — log statement", () => {
    it("parses log with string", () => {
        const stmt = firstStmt('workflow:\n    log "Processing order"') as LogStatement;
        expect(stmt.kind).toBe("LogStatement");
        expect(stmt.expression.kind).toBe("StringLiteral");
    });

    it("parses log with interpolated string", () => {
        const stmt = firstStmt('workflow:\n    log "Processing {order.id}"') as LogStatement;
        expect(stmt.expression.kind).toBe("InterpolatedString");
    });
});

// ============================================================
// Complete / reject
// ============================================================

describe("Parser — complete statement", () => {
    it("parses complete with key-value outputs", () => {
        const source = 'workflow:\n    complete with status "success" and id response.id';
        const stmt = firstStmt(source) as CompleteStatement;
        expect(stmt.kind).toBe("CompleteStatement");
        expect(stmt.outputs).toHaveLength(2);
        expect(stmt.outputs[0]!.name).toBe("status");
        expect(stmt.outputs[1]!.name).toBe("id");
    });
});

describe("Parser — reject statement", () => {
    it("parses reject with a message", () => {
        const source = 'workflow:\n    reject with "Invalid email"';
        const stmt = firstStmt(source) as RejectStatement;
        expect(stmt.kind).toBe("RejectStatement");
        expect(stmt.message.kind).toBe("StringLiteral");
    });
});

// ============================================================
// Service call
// ============================================================

describe("Parser — service call", () => {
    it("parses a simple service call", () => {
        const source = "workflow:\n    verify email using EmailVerifier";
        const stmt = firstStmt(source) as ServiceCall;
        expect(stmt.kind).toBe("ServiceCall");
        expect(stmt.verb).toBe("verify");
        expect(stmt.description).toBe("email");
        expect(stmt.service).toBe("EmailVerifier");
    });

    it("parses service call with multi-word description", () => {
        const source = "workflow:\n    send a welcome email using SendGrid";
        const stmt = firstStmt(source) as ServiceCall;
        expect(stmt.verb).toBe("send");
        expect(stmt.description).toBe("a welcome email");
        expect(stmt.service).toBe("SendGrid");
    });

    it("parses service call with 'to' parameter", () => {
        const source = "workflow:\n    send a welcome email using SendGrid to signup.email";
        const stmt = firstStmt(source) as ServiceCall;
        expect(stmt.parameters).toHaveLength(1);
        expect(stmt.parameters[0]!.name).toBe("to");
    });

    it("parses service call with 'with' parameters", () => {
        const source = 'workflow:\n    create customer using Stripe with name signup.name and email signup.email';
        const stmt = firstStmt(source) as ServiceCall;
        expect(stmt.parameters).toHaveLength(2);
    });
});

// ============================================================
// Step block
// ============================================================

describe("Parser — step block", () => {
    it("parses a named step", () => {
        const source = [
            "workflow:",
            "    step Verify Email:",
            '        log "verifying"',
        ].join("\n");
        const stmt = firstStmt(source) as StepBlock;
        expect(stmt.kind).toBe("StepBlock");
        expect(stmt.name).toBe("Verify Email");
        expect(stmt.body).toHaveLength(1);
    });

    it("parses a step with multiple statements", () => {
        const source = [
            "workflow:",
            "    step Process Order:",
            '        log "step 1"',
            '        log "step 2"',
            '        log "step 3"',
        ].join("\n");
        const stmt = firstStmt(source) as StepBlock;
        expect(stmt.body).toHaveLength(3);
    });
});

// ============================================================
// Error handler
// ============================================================

describe("Parser — error handler", () => {
    it("parses on failure with retry", () => {
        const source = [
            "workflow:",
            "    send email using SendGrid",
            "        on failure:",
            "            retry 3 times waiting 5 seconds",
        ].join("\n");
        const stmt = firstStmt(source) as ServiceCall;
        expect(stmt.errorHandler).not.toBeNull();
        expect(stmt.errorHandler!.retryCount).toBe(3);
        expect(stmt.errorHandler!.retryWaitSeconds).toBe(5);
    });

    it("parses on failure with if still failing fallback", () => {
        const source = [
            "workflow:",
            "    send email using SendGrid",
            "        on failure:",
            "            retry 3 times waiting 5 seconds",
            "            if still failing:",
            '                log "SendGrid is down"',
            '                reject with "Could not send email"',
        ].join("\n");
        const stmt = firstStmt(source) as ServiceCall;
        expect(stmt.errorHandler).not.toBeNull();
        expect(stmt.errorHandler!.fallback).not.toBeNull();
        expect(stmt.errorHandler!.fallback!.length).toBeGreaterThan(0);
    });
});

// ============================================================
// Expressions
// ============================================================

describe("Parser — expressions", () => {
    it("parses deep dot access (3 levels)", () => {
        const stmt = firstStmt("workflow:\n    set x to response.body.id") as SetStatement;
        const expr = stmt.value as DotAccess;
        expect(expr.kind).toBe("DotAccess");
        expect(expr.property).toBe("id");
        const inner = expr.object as DotAccess;
        expect(inner.kind).toBe("DotAccess");
        expect(inner.property).toBe("body");
    });

    it("parses divided by as math operator", () => {
        const stmt = firstStmt("workflow:\n    set avg to total divided by count") as SetStatement;
        const math = stmt.value as MathExpression;
        expect(math.operator).toBe("divided by");
    });

    it("parses rounded to as math operator", () => {
        const stmt = firstStmt("workflow:\n    set result to value rounded to 2") as SetStatement;
        const math = stmt.value as MathExpression;
        expect(math.operator).toBe("rounded to");
    });

    it("parses env dot access", () => {
        const stmt = firstStmt('workflow:\n    set key to env.API_KEY') as SetStatement;
        const expr = stmt.value as DotAccess;
        expect(expr.kind).toBe("DotAccess");
        expect(expr.property).toBe("API_KEY");
    });
});

// ============================================================
// Full multi-block file
// ============================================================

describe("Parser — full file", () => {
    it("parses config + services + workflow", () => {
        const source = [
            "config:",
            '    name: "Order Processing"',
            "    version: 1",
            "",
            "services:",
            '    Stripe is a plugin "flow-connector-stripe"',
            '    EmailVerifier is an API at "https://api.example.com/v1"',
            "",
            "workflow:",
            "    trigger: when a form is submitted",
            "    step Validate:",
            '        log "validating"',
            '    complete with status "done"',
        ].join("\n");

        const program = pOk(source);
        expect(program.config).not.toBeNull();
        expect(program.config!.entries).toHaveLength(2);
        expect(program.services).not.toBeNull();
        expect(program.services!.declarations).toHaveLength(2);
        expect(program.workflow).not.toBeNull();
        expect(program.workflow!.trigger).not.toBeNull();
        expect(program.workflow!.body.length).toBeGreaterThan(0);
    });

    it("handles blocks in any order", () => {
        const source = [
            "workflow:",
            '    log "hello"',
            "",
            "config:",
            '    name: "Test"',
            "",
            "services:",
            '    S is a plugin "x"',
        ].join("\n");

        const program = pOk(source);
        expect(program.config).not.toBeNull();
        expect(program.services).not.toBeNull();
        expect(program.workflow).not.toBeNull();
    });
});

// ============================================================
// Nested constructs
// ============================================================

describe("Parser — nesting", () => {
    it("parses step containing if containing service call", () => {
        const source = [
            "workflow:",
            "    step Check:",
            "        if active is true:",
            "            verify email using EmailVerifier",
        ].join("\n");

        const program = pOk(source);
        const step = program.workflow!.body[0] as StepBlock;
        expect(step.kind).toBe("StepBlock");
        const ifStmt = step.body[0] as IfStatement;
        expect(ifStmt.kind).toBe("IfStatement");
        const svc = ifStmt.body[0] as ServiceCall;
        expect(svc.kind).toBe("ServiceCall");
    });

    it("parses for each inside a step", () => {
        const source = [
            "workflow:",
            "    step Process Items:",
            "        for each item in order.items:",
            '            log "processing"',
        ].join("\n");

        const program = pOk(source);
        const step = program.workflow!.body[0] as StepBlock;
        const loop = step.body[0] as ForEachStatement;
        expect(loop.kind).toBe("ForEachStatement");
        expect(loop.body).toHaveLength(1);
    });

    it("parses if inside for each", () => {
        const source = [
            "workflow:",
            "    for each item in items:",
            "        if item.price is above 100:",
            '            log "expensive"',
            "        otherwise:",
            '            log "cheap"',
        ].join("\n");

        const program = pOk(source);
        const loop = program.workflow!.body[0] as ForEachStatement;
        const ifStmt = loop.body[0] as IfStatement;
        expect(ifStmt.kind).toBe("IfStatement");
        expect(ifStmt.otherwise).toHaveLength(1);
    });
});

// ============================================================
// Error cases
// ============================================================

describe("Parser — error recovery", () => {
    it("reports error for duplicate config blocks", () => {
        const source = "config:\n    name: \"a\"\nconfig:\n    name: \"b\"";
        const errs = pErrors(source);
        expect(errs.length).toBeGreaterThan(0);
        expect(errs.some(e => e.message.includes("Duplicate config"))).toBe(true);
    });

    it("reports error for unknown top-level block", () => {
        const source = "foobar:\n    name: \"a\"";
        const errs = pErrors(source);
        expect(errs.length).toBeGreaterThan(0);
    });

    it("reports error for missing colon after step name", () => {
        const source = "workflow:\n    step Verify Email\n        log \"x\"";
        const errs = pErrors(source);
        expect(errs.length).toBeGreaterThan(0);
    });

    it("continues parsing after an error", () => {
        const source = [
            "config:",
            '    name: "Test"',
            "foobar:",
            "workflow:",
            '    log "hello"',
        ].join("\n");
        const tokens = tokenize(source);
        const result = parse(tokens, source);
        expect(result.program.config).not.toBeNull();
        expect(result.program.workflow).not.toBeNull();
    });
});

// ============================================================
// Line number propagation
// ============================================================

describe("Parser — line numbers", () => {
    it("records correct line for workflow statements", () => {
        const source = [
            "workflow:",            // line 1
            '    log "first"',      // line 2
            '    log "second"',     // line 3
        ].join("\n");
        const body = stmts(source);
        expect(body[0]!.loc.line).toBe(2);
        expect(body[1]!.loc.line).toBe(3);
    });

    it("records correct line for config block", () => {
        const source = 'config:\n    name: "Test"';
        const program = pOk(source);
        expect(program.config!.loc.line).toBe(1);
    });

    it("records correct line for services", () => {
        const source = [
            "services:",
            '    S is a plugin "x"',
        ].join("\n");
        const program = pOk(source);
        expect(program.services!.declarations[0]!.loc.line).toBe(2);
    });
});
