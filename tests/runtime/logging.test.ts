import { describe, it, expect } from "vitest";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import {
    execute,
    text, num, record,
    type ServiceConnector,
} from "../../src/runtime/index.js";
import type { ExecutionResult, LogEntry } from "../../src/types/index.js";

// ============================================================
// Helpers
// ============================================================

async function run(source: string, options?: Parameters<typeof execute>[2]): Promise<ExecutionResult> {
    const tokens = tokenize(source);
    const { program } = parse(tokens, source);
    return await execute(program, source, options);
}

// ============================================================
// Duration tracking
// ============================================================

describe("Logging — duration tracking", () => {
    it("log statements have durationMs null", async () => {
        const result = await run([
            "workflow:",
            "    trigger: manual",
            '    log "hello"',
        ].join("\n"));

        const logEntries = result.log.filter(e => e.action === "log");
        expect(logEntries).toHaveLength(1);
        expect(logEntries[0]!.durationMs).toBeNull();
    });

    it("service call success has durationMs >= 0", async () => {
        const result = await run([
            "services:",
            '    API is an API at "https://example.com"',
            "workflow:",
            "    trigger: manual",
            "    get data using API",
        ].join("\n"));

        const serviceEntries = result.log.filter(e => e.action === "get data");
        expect(serviceEntries).toHaveLength(1);
        expect(serviceEntries[0]!.durationMs).toBeTypeOf("number");
        expect(serviceEntries[0]!.durationMs!).toBeGreaterThanOrEqual(0);
    });

    it("service call failure has durationMs >= 0", async () => {
        const spy: ServiceConnector = {
            async call() { throw new Error("boom"); }
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("API", spy);

        const result = await run([
            "services:",
            '    API is an API at "https://example.com"',
            "workflow:",
            "    trigger: manual",
            "    get data using API",
        ].join("\n"), { connectors });

        expect(result.result.status).toBe("error");
        const serviceEntries = result.log.filter(e => e.action === "get data");
        expect(serviceEntries).toHaveLength(1);
        expect(serviceEntries[0]!.result).toBe("failure");
        expect(serviceEntries[0]!.durationMs).toBeTypeOf("number");
        expect(serviceEntries[0]!.durationMs!).toBeGreaterThanOrEqual(0);
    });

    it("ask statement has durationMs >= 0", async () => {
        const result = await run([
            "services:",
            '    Analyzer is an AI using "anthropic/claude"',
            "workflow:",
            "    trigger: manual",
            '    ask Analyzer to "classify this text"',
            "        save the result as output",
        ].join("\n"));

        const askEntries = result.log.filter(e => e.action.startsWith("ask "));
        expect(askEntries).toHaveLength(1);
        expect(askEntries[0]!.durationMs).toBeTypeOf("number");
        expect(askEntries[0]!.durationMs!).toBeGreaterThanOrEqual(0);
    });

    it("step started has durationMs null", async () => {
        const result = await run([
            "workflow:",
            "    trigger: manual",
            "    step DoWork:",
            '        log "working"',
        ].join("\n"));

        const started = result.log.filter(e => e.action.includes("started"));
        expect(started).toHaveLength(1);
        expect(started[0]!.durationMs).toBeNull();
    });

    it("step completed has durationMs >= 0", async () => {
        const result = await run([
            "workflow:",
            "    trigger: manual",
            "    step DoWork:",
            '        log "working"',
        ].join("\n"));

        const completed = result.log.filter(e => e.action.includes("completed"));
        expect(completed).toHaveLength(1);
        expect(completed[0]!.durationMs).toBeTypeOf("number");
        expect(completed[0]!.durationMs!).toBeGreaterThanOrEqual(0);
    });

    it("all entries have valid Date timestamps", async () => {
        const result = await run([
            "services:",
            '    API is an API at "https://example.com"',
            "workflow:",
            "    trigger: manual",
            "    step Fetch:",
            "        get data using API",
            '    log "done"',
        ].join("\n"));

        for (const entry of result.log) {
            expect(entry.timestamp).toBeInstanceOf(Date);
        }
    });

    it("entries are in chronological order", async () => {
        const result = await run([
            "services:",
            '    API is an API at "https://example.com"',
            "workflow:",
            "    trigger: manual",
            "    step First:",
            "        get data using API",
            "    step Second:",
            '        log "done"',
        ].join("\n"));

        for (let i = 1; i < result.log.length; i++) {
            expect(result.log[i]!.timestamp.getTime()).toBeGreaterThanOrEqual(
                result.log[i - 1]!.timestamp.getTime()
            );
        }
    });
});

// ============================================================
// Structured log envelope
// ============================================================

describe("Logging — structured log envelope", () => {
    it("completed workflow has correct metadata", async () => {
        const result = await run([
            "config:",
            '    name: "Test Workflow"',
            "    version: 2",
            "workflow:",
            "    trigger: manual",
            '    complete with status "ok"',
        ].join("\n"));

        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("ok"));
        }
    });

    it("rejected workflow captures rejection message", async () => {
        const result = await run([
            "workflow:",
            "    trigger: manual",
            '    reject with "invalid input"',
        ].join("\n"));

        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toBe("invalid input");
        }
    });

    it("service call with error handler tracks duration on success", async () => {
        const spy: ServiceConnector = {
            async call() {
                return { value: record({ id: text("123") }) };
            }
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("API", spy);

        const result = await run([
            "services:",
            '    API is an API at "https://example.com"',
            "workflow:",
            "    trigger: manual",
            "    get data using API",
            "        save the result as data",
            "        on failure:",
            "            retry 1 times waiting 1 seconds",
            "            if still failing:",
            '                reject with "failed"',
        ].join("\n"), { connectors });

        expect(result.result.status).toBe("completed");
        const serviceEntries = result.log.filter(e => e.action === "get data");
        expect(serviceEntries).toHaveLength(1);
        expect(serviceEntries[0]!.durationMs).toBeTypeOf("number");
    });

    it("multi-step workflow has correct step labels on entries", async () => {
        const result = await run([
            "workflow:",
            "    trigger: manual",
            "    step Alpha:",
            '        log "a"',
            "    step Beta:",
            '        log "b"',
        ].join("\n"));

        const logA = result.log.find(e => e.action === "log" && e.details["message"] === "a");
        const logB = result.log.find(e => e.action === "log" && e.details["message"] === "b");
        expect(logA!.step).toBe("Alpha");
        expect(logB!.step).toBe("Beta");
    });
});
