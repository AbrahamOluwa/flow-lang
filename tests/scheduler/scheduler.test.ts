import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseEveryExpression, startSchedule } from "../../src/scheduler/index.js";

// ============================================================
// parseEveryExpression
// ============================================================

describe("parseEveryExpression", () => {
    // Minutes
    it("parses '5 minutes' to cron", () => {
        expect(parseEveryExpression("5 minutes")).toBe("*/5 * * * *");
    });

    it("parses '1 minute' (singular)", () => {
        expect(parseEveryExpression("1 minute")).toBe("*/1 * * * *");
    });

    it("parses '30 minutes'", () => {
        expect(parseEveryExpression("30 minutes")).toBe("*/30 * * * *");
    });

    // Hours
    it("parses '2 hours' to cron", () => {
        expect(parseEveryExpression("2 hours")).toBe("0 */2 * * *");
    });

    it("parses '1 hour' (singular)", () => {
        expect(parseEveryExpression("1 hour")).toBe("0 */1 * * *");
    });

    // Simple intervals
    it("parses 'hour' to every hour", () => {
        expect(parseEveryExpression("hour")).toBe("0 * * * *");
    });

    it("parses 'day' to midnight daily", () => {
        expect(parseEveryExpression("day")).toBe("0 0 * * *");
    });

    // Day at time
    it("parses 'day at 9:00'", () => {
        expect(parseEveryExpression("day at 9:00")).toBe("0 9 * * *");
    });

    it("parses 'day at 14:30'", () => {
        expect(parseEveryExpression("day at 14:30")).toBe("30 14 * * *");
    });

    // Weekday
    it("parses 'monday' to midnight monday", () => {
        expect(parseEveryExpression("monday")).toBe("0 0 * * 1");
    });

    it("parses 'friday' to midnight friday", () => {
        expect(parseEveryExpression("friday")).toBe("0 0 * * 5");
    });

    it("parses 'sunday'", () => {
        expect(parseEveryExpression("sunday")).toBe("0 0 * * 0");
    });

    // Weekday at time
    it("parses 'monday at 9:00'", () => {
        expect(parseEveryExpression("monday at 9:00")).toBe("0 9 * * 1");
    });

    it("parses 'friday at 17:30'", () => {
        expect(parseEveryExpression("friday at 17:30")).toBe("30 17 * * 5");
    });

    // Abbreviations
    it("parses 'mon' abbreviation", () => {
        expect(parseEveryExpression("mon")).toBe("0 0 * * 1");
    });

    it("parses 'tue' abbreviation", () => {
        expect(parseEveryExpression("tue")).toBe("0 0 * * 2");
    });

    it("parses 'wed at 8:00'", () => {
        expect(parseEveryExpression("wed at 8:00")).toBe("0 8 * * 3");
    });

    it("parses 'thu' abbreviation", () => {
        expect(parseEveryExpression("thu")).toBe("0 0 * * 4");
    });

    it("parses 'sat' abbreviation", () => {
        expect(parseEveryExpression("sat")).toBe("0 0 * * 6");
    });

    it("parses 'sun' abbreviation", () => {
        expect(parseEveryExpression("sun")).toBe("0 0 * * 0");
    });

    // Case insensitivity
    it("handles uppercase input", () => {
        expect(parseEveryExpression("MONDAY AT 9:00")).toBe("0 9 * * 1");
    });

    it("handles mixed case", () => {
        expect(parseEveryExpression("Day At 14:00")).toBe("0 14 * * *");
    });

    // Whitespace trimming
    it("trims leading and trailing whitespace", () => {
        expect(parseEveryExpression("  5 minutes  ")).toBe("*/5 * * * *");
    });

    // Error cases
    it("throws on unknown format", () => {
        expect(() => parseEveryExpression("whenever")).toThrow("Could not parse schedule");
    });

    it("throws on unknown day name", () => {
        expect(() => parseEveryExpression("funday at 9:00")).toThrow('Unknown day "funday"');
    });

    it("error message includes valid formats", () => {
        try {
            parseEveryExpression("invalid expression");
            expect.fail("Should have thrown");
        } catch (err) {
            const message = (err as Error).message;
            expect(message).toContain("5 minutes");
            expect(message).toContain("day at 9:00");
        }
    });
});

// ============================================================
// startSchedule — validation
// ============================================================

describe("startSchedule — validation", () => {
    beforeEach(() => {
        process.exitCode = undefined;
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        process.exitCode = undefined;
        vi.restoreAllMocks();
    });

    it("errors when neither --cron nor --every is provided", async () => {
        await startSchedule("test.flow", {});
        expect(process.exitCode).toBe(1);
    });

    it("errors on nonexistent .flow file", async () => {
        await startSchedule("nonexistent.flow", { cron: "* * * * *" });
        expect(process.exitCode).toBe(1);
    });

    it("errors on invalid .flow file content", async () => {
        const { writeFileSync, unlinkSync } = await import("fs");
        const { join } = await import("path");
        const { tmpdir } = await import("os");
        const tmpFile = join(tmpdir(), `flow-sched-test-${Date.now()}.flow`);
        writeFileSync(tmpFile, `
workflow:
    if:
        complete with status "ok"
`, "utf-8");

        try {
            await startSchedule(tmpFile, { cron: "* * * * *" });
            expect(process.exitCode).toBe(1);
        } finally {
            unlinkSync(tmpFile);
        }
    });
});
