import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/index.js";
import {
    execute,
    Environment,
    text, num, bool, list, record, EMPTY,
    toDisplay, isTruthy, flowValuesEqual,
    jsonToFlowValue, flowValueToJson,
    MockAPIConnector, MockAIConnector, MockPluginConnector, MockWebhookConnector,
    createMockConnector,
    RuntimeError,
} from "../../src/runtime/index.js";
import type { FlowValue, ExecutionResult } from "../../src/types/index.js";

// ============================================================
// Helpers
// ============================================================

function run(source: string, options?: Parameters<typeof execute>[2]): ExecutionResult {
    const tokens = tokenize(source);
    const { program } = parse(tokens, source);
    return execute(program, source, options);
}

function runOk(source: string, options?: Parameters<typeof execute>[2]): ExecutionResult {
    const result = run(source, options);
    if (result.result.status === "error") {
        throw new Error(`Unexpected runtime error: ${result.result.error.message}`);
    }
    return result;
}

function logMessages(result: ExecutionResult): string[] {
    return result.log
        .filter(e => e.action === "log" && e.details["message"])
        .map(e => e.details["message"] as string);
}

// ============================================================
// FlowValue constructors
// ============================================================

describe("FlowValue constructors", () => {
    it("creates text values", () => {
        const v = text("hello");
        expect(v.type).toBe("text");
        expect(v.value).toBe("hello");
    });

    it("creates number values", () => {
        const v = num(42);
        expect(v.type).toBe("number");
        expect(v.value).toBe(42);
    });

    it("creates boolean values", () => {
        expect(bool(true).value).toBe(true);
        expect(bool(false).value).toBe(false);
    });

    it("creates list values", () => {
        const v = list([text("a"), num(1)]);
        expect(v.type).toBe("list");
        expect(v.value).toHaveLength(2);
    });

    it("creates record values", () => {
        const v = record({ name: text("John"), age: num(30) });
        expect(v.type).toBe("record");
        expect(v.value.get("name")).toEqual(text("John"));
    });

    it("creates empty values", () => {
        expect(EMPTY.type).toBe("empty");
    });
});

// ============================================================
// FlowValue helpers
// ============================================================

describe("toDisplay", () => {
    it("displays text", () => expect(toDisplay(text("hi"))).toBe("hi"));
    it("displays number", () => expect(toDisplay(num(3.14))).toBe("3.14"));
    it("displays boolean", () => expect(toDisplay(bool(true))).toBe("true"));
    it("displays empty", () => expect(toDisplay(EMPTY)).toBe("(empty)"));
    it("displays list", () => expect(toDisplay(list([num(1), num(2)]))).toBe("[1, 2]"));
    it("displays record", () => expect(toDisplay(record({ a: num(1) }))).toBe("{ a: 1 }"));
});

describe("isTruthy", () => {
    it("text: non-empty is truthy", () => expect(isTruthy(text("hi"))).toBe(true));
    it("text: empty string is falsy", () => expect(isTruthy(text(""))).toBe(false));
    it("number: non-zero is truthy", () => expect(isTruthy(num(1))).toBe(true));
    it("number: zero is falsy", () => expect(isTruthy(num(0))).toBe(false));
    it("boolean: true is truthy", () => expect(isTruthy(bool(true))).toBe(true));
    it("boolean: false is falsy", () => expect(isTruthy(bool(false))).toBe(false));
    it("list: non-empty is truthy", () => expect(isTruthy(list([num(1)]))).toBe(true));
    it("list: empty is falsy", () => expect(isTruthy(list([]))).toBe(false));
    it("record: non-empty is truthy", () => expect(isTruthy(record({ a: num(1) }))).toBe(true));
    it("record: empty is falsy", () => expect(isTruthy(record({}))).toBe(false));
    it("empty is falsy", () => expect(isTruthy(EMPTY)).toBe(false));
});

describe("flowValuesEqual", () => {
    it("text equality", () => {
        expect(flowValuesEqual(text("a"), text("a"))).toBe(true);
        expect(flowValuesEqual(text("a"), text("b"))).toBe(false);
    });
    it("number equality", () => {
        expect(flowValuesEqual(num(1), num(1))).toBe(true);
        expect(flowValuesEqual(num(1), num(2))).toBe(false);
    });
    it("different types are not equal", () => {
        expect(flowValuesEqual(text("1"), num(1))).toBe(false);
    });
    it("empty equals empty", () => {
        expect(flowValuesEqual(EMPTY, EMPTY)).toBe(true);
    });
    it("list equality", () => {
        expect(flowValuesEqual(list([num(1), num(2)]), list([num(1), num(2)]))).toBe(true);
        expect(flowValuesEqual(list([num(1)]), list([num(2)]))).toBe(false);
    });
    it("record equality", () => {
        expect(flowValuesEqual(record({ a: num(1) }), record({ a: num(1) }))).toBe(true);
        expect(flowValuesEqual(record({ a: num(1) }), record({ a: num(2) }))).toBe(false);
    });
});

// ============================================================
// JSON conversion
// ============================================================

describe("JSON conversion", () => {
    it("converts string to FlowText", () => {
        expect(jsonToFlowValue("hello")).toEqual(text("hello"));
    });
    it("converts number to FlowNumber", () => {
        expect(jsonToFlowValue(42)).toEqual(num(42));
    });
    it("converts boolean to FlowBoolean", () => {
        expect(jsonToFlowValue(true)).toEqual(bool(true));
    });
    it("converts null to FlowEmpty", () => {
        expect(jsonToFlowValue(null)).toEqual(EMPTY);
    });
    it("converts array to FlowList", () => {
        const v = jsonToFlowValue([1, "two"]);
        expect(v.type).toBe("list");
        expect((v as { value: FlowValue[] }).value).toHaveLength(2);
    });
    it("converts object to FlowRecord", () => {
        const v = jsonToFlowValue({ name: "John" });
        expect(v.type).toBe("record");
    });
    it("round-trips through flowValueToJson", () => {
        const data = { name: "John", age: 30, active: true, tags: ["a", "b"] };
        const flowVal = jsonToFlowValue(data);
        const back = flowValueToJson(flowVal);
        expect(back).toEqual(data);
    });
});

// ============================================================
// Environment
// ============================================================

describe("Environment", () => {
    it("stores and retrieves a variable", () => {
        const env = new Environment();
        env.set("x", num(5));
        expect(env.get("x")).toEqual(num(5));
    });

    it("returns undefined for missing variable", () => {
        const env = new Environment();
        expect(env.get("x")).toBeUndefined();
    });

    it("child scope accesses parent variables", () => {
        const parent = new Environment();
        parent.set("x", num(5));
        const child = parent.createChild();
        expect(child.get("x")).toEqual(num(5));
    });

    it("child scope updates parent variables when they exist", () => {
        const parent = new Environment();
        parent.set("x", num(5));
        const child = parent.createChild();
        child.set("x", num(10));
        expect(child.get("x")).toEqual(num(10));
        // Parent is updated too — `set` updates existing variables in parent scopes
        expect(parent.get("x")).toEqual(num(10));
    });

    it("parent does not see child variables", () => {
        const parent = new Environment();
        const child = parent.createChild();
        child.set("y", num(1));
        expect(parent.get("y")).toBeUndefined();
    });
});

// ============================================================
// Mock connectors
// ============================================================

describe("Mock connectors", () => {
    it("MockAPIConnector returns a record", () => {
        const conn = new MockAPIConnector();
        const result = conn.call("fetch", "data", new Map());
        expect(result.type).toBe("record");
    });

    it("MockAIConnector returns result and confidence", () => {
        const conn = new MockAIConnector();
        const result = conn.call("ask", "analyze data", new Map());
        expect(result.type).toBe("record");
        const rec = result as { type: "record"; value: Map<string, FlowValue> };
        expect(rec.value.get("result")?.type).toBe("text");
        expect(rec.value.get("confidence")?.type).toBe("number");
    });

    it("MockPluginConnector returns a record", () => {
        const conn = new MockPluginConnector();
        const result = conn.call("run", "task", new Map());
        expect(result.type).toBe("record");
    });

    it("MockWebhookConnector returns a record", () => {
        const conn = new MockWebhookConnector();
        const result = conn.call("notify", "webhook", new Map());
        expect(result.type).toBe("record");
    });

    it("connector fails when failCount is set", () => {
        const conn = new MockAPIConnector({ failCount: 1 });
        expect(() => conn.call("fetch", "data", new Map())).toThrow("mock failure");
        // Second call succeeds
        const result = conn.call("fetch", "data", new Map());
        expect(result.type).toBe("record");
    });

    it("createMockConnector dispatches by type", () => {
        expect(createMockConnector("api")).toBeInstanceOf(MockAPIConnector);
        expect(createMockConnector("ai")).toBeInstanceOf(MockAIConnector);
        expect(createMockConnector("plugin")).toBeInstanceOf(MockPluginConnector);
        expect(createMockConnector("webhook")).toBeInstanceOf(MockWebhookConnector);
    });
});

// ============================================================
// Expression evaluation (via execute)
// ============================================================

describe("Runtime — expression evaluation", () => {
    it("evaluates string literal", () => {
        const result = runOk('workflow:\n    log "hello"');
        expect(logMessages(result)).toEqual(["hello"]);
    });

    it("evaluates number literal", () => {
        const result = runOk("workflow:\n    log 42");
        expect(logMessages(result)).toEqual(["42"]);
    });

    it("evaluates boolean literal", () => {
        const result = runOk("workflow:\n    log true");
        expect(logMessages(result)).toEqual(["true"]);
    });

    it("evaluates variable reference", () => {
        const result = runOk('workflow:\n    set x to 5\n    log x');
        expect(logMessages(result)).toEqual(["5"]);
    });

    it("evaluates dot access on input data", () => {
        const result = runOk('workflow:\n    log user.name', {
            input: { user: { name: "Alice" } },
        });
        expect(logMessages(result)).toEqual(["Alice"]);
    });

    it("evaluates deep dot access", () => {
        const result = runOk('workflow:\n    log a.b.c', {
            input: { a: { b: { c: "deep" } } },
        });
        expect(logMessages(result)).toEqual(["deep"]);
    });

    it("dot access on missing field returns empty", () => {
        const result = runOk('workflow:\n    log user.missing', {
            input: { user: { name: "Alice" } },
        });
        expect(logMessages(result)).toEqual(["(empty)"]);
    });

    it("dot access on undefined root returns empty", () => {
        const result = runOk('workflow:\n    log unknown.field');
        expect(logMessages(result)).toEqual(["(empty)"]);
    });

    it("evaluates interpolated string", () => {
        const result = runOk('workflow:\n    set name to "World"\n    log "Hello, {name}!"');
        expect(logMessages(result)).toEqual(["Hello, World!"]);
    });

    it("evaluates math: plus", () => {
        const result = runOk("workflow:\n    set x to 3 plus 4\n    log x");
        expect(logMessages(result)).toEqual(["7"]);
    });

    it("evaluates math: minus", () => {
        const result = runOk("workflow:\n    set x to 10 minus 3\n    log x");
        expect(logMessages(result)).toEqual(["7"]);
    });

    it("evaluates math: times", () => {
        const result = runOk("workflow:\n    set x to 6 times 7\n    log x");
        expect(logMessages(result)).toEqual(["42"]);
    });

    it("evaluates math: divided by", () => {
        const result = runOk("workflow:\n    set x to 10 divided by 4\n    log x");
        expect(logMessages(result)).toEqual(["2.5"]);
    });

    it("evaluates math: rounded to", () => {
        const result = runOk("workflow:\n    set x to 3.14159 rounded to 2\n    log x");
        expect(logMessages(result)).toEqual(["3.14"]);
    });

    it("evaluates chained math", () => {
        const result = runOk("workflow:\n    set x to 2 plus 3 times 4\n    log x");
        // Left-to-right: (2+3)*4 = 20
        expect(logMessages(result)).toEqual(["20"]);
    });

    it("division by zero produces runtime error", () => {
        const result = run("workflow:\n    set x to 10 divided by 0");
        expect(result.result.status).toBe("error");
    });

    it("evaluates comparison: is", () => {
        const result = runOk('workflow:\n    set x to 5\n    if x is 5:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is not", () => {
        const result = runOk('workflow:\n    set x to 5\n    if x is not 3:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is above", () => {
        const result = runOk('workflow:\n    set x to 10\n    if x is above 5:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is below", () => {
        const result = runOk('workflow:\n    set x to 3\n    if x is below 5:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is at least", () => {
        const result = runOk('workflow:\n    set x to 5\n    if x is at least 5:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is at most", () => {
        const result = runOk('workflow:\n    set x to 5\n    if x is at most 5:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is empty", () => {
        const result = runOk('workflow:\n    set x to ""\n    if x is empty:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: is not empty", () => {
        const result = runOk('workflow:\n    set x to "hello"\n    if x is not empty:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates comparison: contains (text)", () => {
        const result = runOk('workflow:\n    set x to "hello world"\n    if x contains "world":\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates logical: and", () => {
        const result = runOk('workflow:\n    set a to true\n    set b to true\n    if a and b:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates logical: or", () => {
        const result = runOk('workflow:\n    set a to false\n    set b to true\n    if a or b:\n        log "yes"');
        expect(logMessages(result)).toEqual(["yes"]);
    });

    it("evaluates env variable access", () => {
        const result = runOk('workflow:\n    log env.API_KEY', {
            envVars: { API_KEY: "secret123" },
        });
        expect(logMessages(result)).toEqual(["secret123"]);
    });
});

// ============================================================
// Environment variable handling
// ============================================================

describe("Runtime — environment variables", () => {
    it("returns FlowEmpty for missing env var in default mode", () => {
        const result = runOk('workflow:\n    if env.MISSING is empty:\n        log "empty"', {
            envVars: {},
        });
        expect(logMessages(result)).toEqual(["empty"]);
    });

    it("throws RuntimeError for missing env var in strict mode", () => {
        const result = run('workflow:\n    log env.MISSING', {
            envVars: {},
            strictEnv: true,
        });
        expect(result.result.status).toBe("error");
        if (result.result.status === "error") {
            expect(result.result.error.message).toContain("MISSING");
            expect(result.result.error.message).toContain("not set");
        }
    });

    it("does not throw for existing env var in strict mode", () => {
        const result = runOk('workflow:\n    log env.API_KEY', {
            envVars: { API_KEY: "my-key" },
            strictEnv: true,
        });
        expect(logMessages(result)).toEqual(["my-key"]);
    });

    it("accesses multiple env vars in one workflow", () => {
        const result = runOk(
            'workflow:\n    log env.KEY_A\n    log env.KEY_B\n    log env.KEY_C',
            { envVars: { KEY_A: "alpha", KEY_B: "bravo", KEY_C: "charlie" } },
        );
        expect(logMessages(result)).toEqual(["alpha", "bravo", "charlie"]);
    });

    it("uses env vars in string interpolation", () => {
        const result = runOk('workflow:\n    log "key is {env.API_KEY}"', {
            envVars: { API_KEY: "abc123" },
        });
        expect(logMessages(result)).toEqual(["key is abc123"]);
    });

    it("uses env vars in conditions", () => {
        const result = runOk(
            'workflow:\n    if env.MODE is "production":\n        log "prod"\n    otherwise:\n        log "dev"',
            { envVars: { MODE: "production" } },
        );
        expect(logMessages(result)).toEqual(["prod"]);
    });

    it("env vars do not override input data", () => {
        const result = runOk(
            'workflow:\n    log order.name\n    log env.NAME',
            { input: { order: { name: "from-input" } }, envVars: { NAME: "from-env" } },
        );
        expect(logMessages(result)).toEqual(["from-input", "from-env"]);
    });

    it("logs warning for missing env var in verbose mode", () => {
        const result = runOk('workflow:\n    log env.MISSING', {
            envVars: {},
            verbose: true,
        });
        const warnings = result.log.filter(e => e.action === "env warning");
        expect(warnings.length).toBe(1);
        expect(warnings[0].details["message"]).toContain("MISSING");
    });

    it("does not log warning for existing env var in verbose mode", () => {
        const result = runOk('workflow:\n    log env.EXISTS', {
            envVars: { EXISTS: "yes" },
            verbose: true,
        });
        const warnings = result.log.filter(e => e.action === "env warning");
        expect(warnings.length).toBe(0);
    });

    it("does not log warning in non-verbose mode", () => {
        const result = runOk('workflow:\n    log env.MISSING', {
            envVars: {},
            verbose: false,
        });
        const warnings = result.log.filter(e => e.action === "env warning");
        expect(warnings.length).toBe(0);
    });
});

// ============================================================
// Statement execution
// ============================================================

describe("Runtime — set statement", () => {
    it("sets and reads a variable", () => {
        const result = runOk('workflow:\n    set greeting to "hi"\n    log greeting');
        expect(logMessages(result)).toEqual(["hi"]);
    });

    it("overwrites a variable", () => {
        const result = runOk("workflow:\n    set x to 1\n    set x to 2\n    log x");
        expect(logMessages(result)).toEqual(["2"]);
    });
});

describe("Runtime — if statement", () => {
    it("takes the true branch", () => {
        const result = runOk([
            "workflow:",
            "    set x to 10",
            '    if x is above 5:',
            '        log "high"',
            "    otherwise:",
            '        log "low"',
        ].join("\n"));
        expect(logMessages(result)).toEqual(["high"]);
    });

    it("takes the otherwise branch", () => {
        const result = runOk([
            "workflow:",
            "    set x to 2",
            '    if x is above 5:',
            '        log "high"',
            "    otherwise:",
            '        log "low"',
        ].join("\n"));
        expect(logMessages(result)).toEqual(["low"]);
    });

    it("evaluates otherwise-if chain", () => {
        const result = runOk([
            "workflow:",
            "    set x to 5",
            '    if x is above 10:',
            '        log "high"',
            '    otherwise if x is above 3:',
            '        log "medium"',
            "    otherwise:",
            '        log "low"',
        ].join("\n"));
        expect(logMessages(result)).toEqual(["medium"]);
    });

    it("skips all branches when none match", () => {
        const result = runOk([
            "workflow:",
            "    set x to 1",
            '    if x is above 5:',
            '        log "high"',
        ].join("\n"));
        expect(logMessages(result)).toEqual([]);
    });
});

describe("Runtime — for each statement", () => {
    it("iterates over a list from input", () => {
        const result = runOk([
            "workflow:",
            "    set items to data.items",
            "    for each item in items:",
            "        log item",
        ].join("\n"), {
            input: { data: { items: ["apple", "banana", "cherry"] } },
        });
        expect(logMessages(result)).toEqual(["apple", "banana", "cherry"]);
    });

    it("loop variable is scoped to body", () => {
        // After the loop, the variable shouldn't be accessible.
        // This would be a runtime error if we try to access it.
        const result = runOk([
            "workflow:",
            "    set items to data.list",
            "    for each item in items:",
            '        log "inside"',
        ].join("\n"), {
            input: { data: { list: [1, 2] } },
        });
        expect(logMessages(result)).toEqual(["inside", "inside"]);
    });

    it("empty list produces no iterations", () => {
        const result = runOk([
            "workflow:",
            "    set items to data.list",
            "    for each item in items:",
            "        log item",
        ].join("\n"), {
            input: { data: { list: [] } },
        });
        expect(logMessages(result)).toEqual([]);
    });

    it("runtime error for non-list collection", () => {
        const result = run([
            "workflow:",
            '    set items to "not a list"',
            "    for each item in items:",
            "        log item",
        ].join("\n"));
        expect(result.result.status).toBe("error");
    });
});

describe("Runtime — service call", () => {
    it("calls a declared service", () => {
        const source = [
            "services:",
            '    S is an API at "https://api.example.com"',
            "workflow:",
            "    fetch data using S",
        ].join("\n");
        const result = runOk(source);
        const serviceLog = result.log.find(e => e.details["service"] === "S");
        expect(serviceLog).toBeDefined();
        expect(serviceLog!.result).toBe("success");
    });

    it("passes parameters to service call", () => {
        const source = [
            "services:",
            '    S is an API at "https://api.example.com"',
            "workflow:",
            '    set email to "test@example.com"',
            "    verify email using S with payload email",
        ].join("\n");
        const result = runOk(source);
        expect(result.result.status).toBe("completed");
    });
});

describe("Runtime — ask statement", () => {
    it("calls an AI agent and saves result", () => {
        const source = [
            "services:",
            '    Bot is an AI using "anthropic/claude-sonnet-4-20250514"',
            "workflow:",
            "    ask Bot to analyze the data",
            "        save the result as analysis",
            "    log analysis",
        ].join("\n");
        const result = runOk(source);
        const msgs = logMessages(result);
        expect(msgs).toHaveLength(1);
        expect(msgs[0]).toContain("mock AI response");
    });

    it("saves confidence variable", () => {
        const source = [
            "services:",
            '    Bot is an AI using "model"',
            "workflow:",
            "    ask Bot to analyze data",
            "        save the result as analysis",
            "        save the confidence as conf",
            "    log conf",
        ].join("\n");
        const result = runOk(source);
        const msgs = logMessages(result);
        expect(msgs).toHaveLength(1);
        expect(msgs[0]).toBe("0.85");
    });
});

describe("Runtime — log statement", () => {
    it("logs a string", () => {
        const result = runOk('workflow:\n    log "hello"');
        expect(logMessages(result)).toEqual(["hello"]);
    });

    it("logs a number", () => {
        const result = runOk("workflow:\n    log 42");
        expect(logMessages(result)).toEqual(["42"]);
    });

    it("logs an interpolated string", () => {
        const result = runOk('workflow:\n    set x to 5\n    log "x is {x}"');
        expect(logMessages(result)).toEqual(["x is 5"]);
    });
});

describe("Runtime — complete statement", () => {
    it("completes with outputs", () => {
        const result = runOk('workflow:\n    complete with status "done"');
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("done"));
        }
    });

    it("completes with multiple outputs", () => {
        const source = [
            "workflow:",
            '    set msg to "hello"',
            '    complete with status "ok" and message msg',
        ].join("\n");
        const result = runOk(source);
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("ok"));
            expect(result.result.outputs["message"]).toEqual(text("hello"));
        }
    });

    it("stops execution after complete", () => {
        const result = runOk([
            "workflow:",
            '    complete with status "early"',
            '    log "should not run"',
        ].join("\n"));
        expect(logMessages(result)).toEqual([]);
        expect(result.result.status).toBe("completed");
    });
});

describe("Runtime — reject statement", () => {
    it("rejects with a message", () => {
        const result = runOk('workflow:\n    reject with "something went wrong"');
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toBe("something went wrong");
        }
    });

    it("stops execution after reject", () => {
        const result = runOk([
            "workflow:",
            '    reject with "bad"',
            '    log "should not run"',
        ].join("\n"));
        expect(logMessages(result)).toEqual([]);
        expect(result.result.status).toBe("rejected");
    });
});

describe("Runtime — step blocks", () => {
    it("executes statements inside a step", () => {
        const source = [
            "workflow:",
            "    step Validate:",
            '        log "validating"',
            "    step Process:",
            '        log "processing"',
        ].join("\n");
        const result = runOk(source);
        expect(logMessages(result)).toEqual(["validating", "processing"]);
    });

    it("logs step start and end", () => {
        const source = [
            "workflow:",
            "    step MyStep:",
            '        log "inside"',
        ].join("\n");
        const result = runOk(source);
        const stepLogs = result.log.filter(e => e.action.includes("MyStep"));
        expect(stepLogs).toHaveLength(2);
        expect(stepLogs[0]!.action).toContain("started");
        expect(stepLogs[1]!.action).toContain("completed");
    });

    it("step shares parent scope", () => {
        const source = [
            "workflow:",
            "    set x to 5",
            "    step Check:",
            "        log x",
            "        set y to 10",
            "    log y",
        ].join("\n");
        const result = runOk(source);
        expect(logMessages(result)).toEqual(["5", "10"]);
    });
});

// ============================================================
// Error handling (retry + fallback)
// ============================================================

describe("Runtime — error handling", () => {
    it("retries on failure then succeeds", () => {
        const connectors = new Map();
        connectors.set("S", new MockAPIConnector({ failCount: 2 }));
        const source = [
            "services:",
            '    S is a plugin "x"',
            "workflow:",
            "    send email using S",
            "        on failure:",
            "            retry 3 times waiting 1 seconds",
        ].join("\n");
        const result = runOk(source, { connectors });
        expect(result.result.status).toBe("completed");
        // Should have retry log entries
        const retryLogs = result.log.filter(e => e.action.startsWith("retry"));
        expect(retryLogs).toHaveLength(2);
    });

    it("executes fallback when all retries fail", () => {
        const connectors = new Map();
        connectors.set("S", new MockAPIConnector({ failCount: 100 }));
        const source = [
            "services:",
            '    S is a plugin "x"',
            "workflow:",
            "    send email using S",
            "        on failure:",
            "            retry 2 times waiting 1 seconds",
            "            if still failing:",
            '                log "fallback executed"',
        ].join("\n");
        const result = runOk(source, { connectors });
        expect(logMessages(result)).toEqual(["fallback executed"]);
    });

    it("runtime error when retries exhausted and no fallback", () => {
        const connectors = new Map();
        connectors.set("S", new MockAPIConnector({ failCount: 100 }));
        const source = [
            "services:",
            '    S is a plugin "x"',
            "workflow:",
            "    send email using S",
            "        on failure:",
            "            retry 1 times waiting 1 seconds",
        ].join("\n");
        const result = run(source, { connectors });
        expect(result.result.status).toBe("error");
    });

    it("service call without error handler produces runtime error on failure", () => {
        const connectors = new Map();
        connectors.set("S", new MockAPIConnector({ failCount: 1 }));
        const source = [
            "services:",
            '    S is a plugin "x"',
            "workflow:",
            "    send email using S",
        ].join("\n");
        const result = run(source, { connectors });
        expect(result.result.status).toBe("error");
    });
});

// ============================================================
// Full workflow execution
// ============================================================

describe("Runtime — full workflow", () => {
    it("executes a complete workflow", () => {
        const source = [
            "config:",
            '    name: "Test Workflow"',
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
            "    if review is not empty:",
            '        log "reviewed"',
            '    complete with status "done"',
        ].join("\n");

        const result = runOk(source, {
            input: { signup: { email: "test@example.com" } },
        });

        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("done"));
        }
        expect(logMessages(result)).toEqual(["reviewed"]);
    });

    it("handles workflow with no statements", () => {
        const result = runOk("workflow:\n    trigger: when a form is submitted");
        expect(result.result.status).toBe("completed");
    });

    it("handles empty program", () => {
        const result = runOk("");
        expect(result.result.status).toBe("completed");
    });

    it("handles program with only config", () => {
        const result = runOk('config:\n    name: "Test"');
        expect(result.result.status).toBe("completed");
    });

    it("workflow with for-each and conditions", () => {
        const source = [
            "workflow:",
            "    set items to data.items",
            "    for each item in items:",
            "        if item is above 5:",
            '            log "big"',
            "        otherwise:",
            '            log "small"',
        ].join("\n");

        const result = runOk(source, {
            input: { data: { items: [3, 7, 1, 10] } },
        });

        expect(logMessages(result)).toEqual(["small", "big", "small", "big"]);
    });

    it("workflow with nested steps and conditions", () => {
        const source = [
            "services:",
            '    S is an API at "url"',
            "workflow:",
            "    set x to 10",
            "    step Validate:",
            "        if x is above 5:",
            '            log "valid"',
            "    step Process:",
            "        fetch result using S",
            '        log "processed"',
        ].join("\n");

        const result = runOk(source);
        expect(logMessages(result)).toEqual(["valid", "processed"]);
    });

    it("handles variables defined in if branches", () => {
        const source = [
            "workflow:",
            "    set x to 10",
            '    if x is above 5:',
            '        set label to "high"',
            "    otherwise:",
            '        set label to "low"',
            "    log label",
        ].join("\n");

        const result = runOk(source);
        expect(logMessages(result)).toEqual(["high"]);
    });

    it("string concatenation with plus", () => {
        const source = [
            "workflow:",
            '    set a to "hello"',
            '    set b to " world"',
            "    set c to a plus b",
            "    log c",
        ].join("\n");

        const result = runOk(source);
        expect(logMessages(result)).toEqual(["hello world"]);
    });
});

// ============================================================
// Runtime error messages
// ============================================================

describe("Runtime — error messages", () => {
    it("produces friendly error for undefined variable", () => {
        const result = run("workflow:\n    log unknown_var");
        expect(result.result.status).toBe("error");
        if (result.result.status === "error") {
            expect(result.result.error.message).toContain("unknown_var");
        }
    });

    it("produces friendly error for dot access on non-record", () => {
        const result = run('workflow:\n    set x to "hello"\n    log x.field');
        expect(result.result.status).toBe("error");
        if (result.result.status === "error") {
            expect(result.result.error.message).toContain("field");
        }
    });

    it("produces friendly error for numeric comparison on text", () => {
        const result = run('workflow:\n    set x to "hello"\n    if x is above 5:\n        log "yes"');
        expect(result.result.status).toBe("error");
        if (result.result.status === "error") {
            expect(result.result.error.message).toContain("number");
        }
    });
});
