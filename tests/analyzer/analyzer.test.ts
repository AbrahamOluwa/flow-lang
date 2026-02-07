import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/index.js";
import type { FlowError } from "../../src/types/index.js";

// Helper: lex + parse + analyze, return errors
function check(source: string): FlowError[] {
    const tokens = tokenize(source);
    const { program } = parse(tokens, source);
    return analyze(program, source);
}

// Helper: expect zero errors
function checkOk(source: string): void {
    const errs = check(source);
    expect(errs, `Unexpected errors: ${errs.map(e => e.message).join("; ")}`).toHaveLength(0);
}

// Helper: expect at least one error containing a substring
function checkHasError(source: string, substring: string): FlowError[] {
    const errs = check(source);
    const match = errs.find(e => e.message.includes(substring));
    expect(match, `Expected an error containing "${substring}" but got: ${errs.map(e => e.message).join("; ") || "(none)"}`).toBeDefined();
    return errs;
}

// Helper: expect at least one warning containing a substring
function checkHasWarning(source: string, substring: string): FlowError[] {
    const errs = check(source);
    const match = errs.find(e => e.message.includes(substring) && e.severity === "warning");
    expect(match, `Expected a warning containing "${substring}" but got: ${errs.map(e => `[${e.severity}] ${e.message}`).join("; ") || "(none)"}`).toBeDefined();
    return errs;
}

// ============================================================
// Valid programs — no errors
// ============================================================

describe("Analyzer — valid programs", () => {
    it("accepts an empty program", () => {
        checkOk("");
    });

    it("accepts config only", () => {
        checkOk('config:\n    name: "Test"\n    version: 1');
    });

    it("accepts services only", () => {
        checkOk('services:\n    S is a plugin "x"');
    });

    it("accepts a minimal workflow", () => {
        checkOk('workflow:\n    log "hello"');
    });

    it("accepts a full valid program", () => {
        const source = [
            "config:",
            '    name: "Test"',
            "    version: 1",
            "",
            "services:",
            '    EmailVerifier is an API at "https://api.example.com"',
            '    Analyst is an AI using "anthropic/claude-sonnet-4-20250514"',
            "",
            "workflow:",
            "    trigger: when a form is submitted",
            "    set email to signup.email",
            "    verify email using EmailVerifier",
            "    ask Analyst to review the email",
            "        save the result as review",
            '    if review is not empty:',
            '        log "reviewed"',
            '    complete with status "done"',
        ].join("\n");
        checkOk(source);
    });

    it("accepts set then use of a variable", () => {
        checkOk('workflow:\n    set x to 5\n    log x');
    });

    it("accepts for-each loop variable inside body", () => {
        const source = [
            "workflow:",
            "    set items to order.items",
            "    for each item in items:",
            '        log item',
        ].join("\n");
        checkOk(source);
    });

    it("accepts ask result/confidence variables", () => {
        const source = [
            "services:",
            '    Bot is an AI using "model"',
            "workflow:",
            "    ask Bot to analyze data",
            "        save the result as analysis",
            "        save the confidence as confidence",
            "    log analysis",
            "    log confidence",
        ].join("\n");
        checkOk(source);
    });

    it("accepts env variable access", () => {
        checkOk("workflow:\n    set key to env.API_KEY");
    });

    it("accepts variables set in if branches used later", () => {
        const source = [
            "workflow:",
            "    set x to 5",
            "    if x is above 3:",
            '        set label to "high"',
            "    otherwise:",
            '        set label to "low"',
            // Note: label may or may not be defined depending on branch,
            // but since our analyzer doesn't do branch analysis, it sees
            // label defined after the if. We'll let this pass for now.
        ].join("\n");
        checkOk(source);
    });
});

// ============================================================
// Service resolution errors
// ============================================================

describe("Analyzer — service resolution", () => {
    it("reports error for undeclared service in service call", () => {
        const source = [
            "services:",
            '    EmailVerifier is an API at "https://api.example.com"',
            "workflow:",
            "    verify email using FooService",
        ].join("\n");
        checkHasError(source, "FooService");
    });

    it("suggests closest service name", () => {
        const source = [
            "services:",
            '    EmailVerifier is an API at "https://api.example.com"',
            "workflow:",
            "    verify email using EmailCheker",
        ].join("\n");
        const errs = check(source);
        const err = errs.find(e => e.message.includes("EmailCheker"));
        expect(err).toBeDefined();
        expect(err!.suggestion).toContain("EmailVerifier");
    });

    it("reports error for undeclared agent in ask statement", () => {
        const source = [
            "services:",
            '    Bot is an AI using "model"',
            "workflow:",
            "    ask UnknownAgent to do something",
        ].join("\n");
        checkHasError(source, "UnknownAgent");
    });

    it("does not report error for declared service", () => {
        const source = [
            "services:",
            '    S is a plugin "x"',
            "workflow:",
            "    run task using S",
        ].join("\n");
        checkOk(source);
    });

    it("reports error when services block is missing but service is used", () => {
        const source = "workflow:\n    run task using SomeService";
        checkHasError(source, "SomeService");
    });
});

// ============================================================
// Variable def-before-use
// ============================================================

describe("Analyzer — variable def-before-use", () => {
    it("reports error for undefined variable", () => {
        checkHasError('workflow:\n    log unknown_var', "unknown_var");
    });

    it("suggests closest defined variable", () => {
        const source = [
            "workflow:",
            '    set greeting to "hello"',
            "    log greting",
        ].join("\n");
        const errs = check(source);
        const err = errs.find(e => e.message.includes("greting"));
        expect(err).toBeDefined();
        expect(err!.suggestion).toContain("greeting");
    });

    it("reports error for use before set", () => {
        const source = [
            "workflow:",
            "    log x",
            "    set x to 5",
        ].join("\n");
        checkHasError(source, "x");
    });

    it("accepts variable used after set", () => {
        const source = [
            "workflow:",
            "    set x to 5",
            "    log x",
        ].join("\n");
        checkOk(source);
    });

    it("checks variables inside interpolated strings", () => {
        checkHasError('workflow:\n    log "Hello, {missing_name}"', "missing_name");
    });

    it("checks variables inside math expressions", () => {
        const source = [
            "workflow:",
            "    set total to unknown_price times 2",
        ].join("\n");
        checkHasError(source, "unknown_price");
    });

    it("does not flag dot-access roots (may be implicit trigger data)", () => {
        // Dot-access like `undefined_obj.field` is treated as potentially
        // valid trigger/service data, so no error is produced.
        checkOk("workflow:\n    set x to some_input.field");
    });

    it("checks variables in condition expressions", () => {
        const source = [
            "workflow:",
            "    if undefined_flag is true:",
            '        log "yes"',
        ].join("\n");
        checkHasError(source, "undefined_flag");
    });

    it("checks variables in complete outputs", () => {
        checkHasError('workflow:\n    complete with result undefined_val', "undefined_val");
    });

    it("checks variables in reject message", () => {
        checkHasError("workflow:\n    reject with undefined_msg", "undefined_msg");
    });
});

// ============================================================
// Scope checking — for-each loop variable
// ============================================================

describe("Analyzer — scope checking", () => {
    it("allows loop variable inside the loop", () => {
        const source = [
            "workflow:",
            "    set items to data.list",
            "    for each item in items:",
            "        log item",
        ].join("\n");
        checkOk(source);
    });

    it("reports error for loop variable used outside the loop", () => {
        const source = [
            "workflow:",
            "    set items to data.list",
            "    for each item in items:",
            '        log "inside"',
            "    log item",
        ].join("\n");
        checkHasError(source, "item");
    });

    it("loop variables from different loops don't leak", () => {
        const source = [
            "workflow:",
            "    set list1 to a.items",
            "    set list2 to b.items",
            "    for each x in list1:",
            "        log x",
            "    for each y in list2:",
            "        log y",
            "    log x",
        ].join("\n");
        checkHasError(source, "x");
    });
});

// ============================================================
// Duplicate detection
// ============================================================

describe("Analyzer — duplicate detection", () => {
    it("reports error for duplicate step names", () => {
        const source = [
            "workflow:",
            "    step Validate:",
            '        log "v1"',
            "    step Validate:",
            '        log "v2"',
        ].join("\n");
        checkHasError(source, "Duplicate step name");
    });

    it("reports error for duplicate service names", () => {
        const source = [
            "services:",
            '    S is a plugin "x"',
            '    S is an API at "y"',
        ].join("\n");
        checkHasError(source, "Duplicate service name");
    });

    it("reports error for duplicate config keys", () => {
        const source = [
            "config:",
            '    name: "A"',
            '    name: "B"',
        ].join("\n");
        checkHasError(source, "Duplicate config key");
    });

    it("allows different step names", () => {
        const source = [
            "workflow:",
            "    step First:",
            '        log "1"',
            "    step Second:",
            '        log "2"',
        ].join("\n");
        checkOk(source);
    });
});

// ============================================================
// Config validation
// ============================================================

describe("Analyzer — config validation", () => {
    it("warns on unknown config key", () => {
        checkHasWarning('config:\n    foobar: "x"', "Unknown config key");
    });

    it("accepts known config keys without warning", () => {
        const source = [
            "config:",
            '    name: "Test"',
            "    version: 1",
            "    timeout: 5 minutes",
        ].join("\n");
        const errs = check(source);
        const warnings = errs.filter(e => e.severity === "warning");
        expect(warnings).toHaveLength(0);
    });
});

// ============================================================
// Multiple errors in one pass
// ============================================================

describe("Analyzer — multiple errors", () => {
    it("collects multiple errors in a single pass", () => {
        const source = [
            "services:",
            '    S is a plugin "x"',
            '    S is a plugin "y"',
            "workflow:",
            "    step Dup:",
            '        log "a"',
            "    step Dup:",
            '        log "b"',
            "    run task using Unknown",
            "    log undefined_var",
        ].join("\n");
        const errs = check(source);
        // Should have at least: duplicate service, duplicate step, unknown service, undefined var
        expect(errs.length).toBeGreaterThanOrEqual(4);
    });

    it("reports both undeclared service and undefined variable", () => {
        const source = "workflow:\n    send msg using Bad to undefined_target";
        const errs = check(source);
        expect(errs.some(e => e.message.includes("Bad"))).toBe(true);
        expect(errs.some(e => e.message.includes("undefined_target"))).toBe(true);
    });
});

// ============================================================
// Error handler analysis
// ============================================================

describe("Analyzer — error handler", () => {
    it("checks variables in error handler fallback", () => {
        const source = [
            "services:",
            '    SG is a plugin "x"',
            "workflow:",
            "    send email using SG",
            "        on failure:",
            "            retry 3 times waiting 5 seconds",
            "            if still failing:",
            "                log unknown_thing",
        ].join("\n");
        checkHasError(source, "unknown_thing");
    });

    it("accepts valid variables in error handler fallback", () => {
        const source = [
            "services:",
            '    SG is a plugin "x"',
            "workflow:",
            '    set msg to "alert"',
            "    send email using SG",
            "        on failure:",
            "            retry 3 times waiting 5 seconds",
            "            if still failing:",
            "                log msg",
        ].join("\n");
        checkOk(source);
    });
});

// ============================================================
// Edge cases
// ============================================================

describe("Analyzer — edge cases", () => {
    it("handles nested if with variables defined in outer scope", () => {
        const source = [
            "workflow:",
            "    set x to 5",
            "    step Check:",
            "        if x is above 3:",
            "            set y to x",
            "            log y",
        ].join("\n");
        checkOk(source);
    });

    it("handles service call params referencing dot access", () => {
        const source = [
            "services:",
            '    S is an API at "url"',
            "workflow:",
            "    set data to input.data",
            "    fetch result using S with payload data",
        ].join("\n");
        checkOk(source);
    });

    it("handles workflow with only trigger and no statements", () => {
        const source = [
            "workflow:",
            "    trigger: when a form is submitted",
        ].join("\n");
        checkOk(source);
    });
});
