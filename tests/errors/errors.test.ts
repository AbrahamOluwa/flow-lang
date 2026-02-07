import { describe, it, expect } from "vitest";
import {
    levenshtein,
    findClosestMatch,
    formatError,
    createError,
} from "../../src/errors/index.js";
import type { FlowError } from "../../src/types/index.js";

describe("levenshtein", () => {
    it("returns 0 for identical strings", () => {
        expect(levenshtein("hello", "hello")).toBe(0);
    });

    it("returns the length of the other string when one is empty", () => {
        expect(levenshtein("", "abc")).toBe(3);
        expect(levenshtein("abc", "")).toBe(3);
    });

    it("computes correct distance for single edits", () => {
        expect(levenshtein("cat", "bat")).toBe(1);   // substitution
        expect(levenshtein("cat", "cats")).toBe(1);  // insertion
        expect(levenshtein("cats", "cat")).toBe(1);  // deletion
    });

    it("is case-insensitive", () => {
        expect(levenshtein("Hello", "hello")).toBe(0);
        expect(levenshtein("ABC", "abc")).toBe(0);
    });

    it("computes correct distance for multiple edits", () => {
        expect(levenshtein("kitten", "sitting")).toBe(3);
    });
});

describe("findClosestMatch", () => {
    const candidates = ["EmailVerifier", "Stripe", "SlackNotifier"];

    it("finds an exact match", () => {
        expect(findClosestMatch("EmailVerifier", candidates)).toBe("EmailVerifier");
    });

    it("finds a close match", () => {
        expect(findClosestMatch("EmailChecker", candidates)).toBe("EmailVerifier");
    });

    it("returns null when no candidate is close enough", () => {
        expect(findClosestMatch("CompletelyDifferent", candidates)).toBeNull();
    });

    it("returns null for empty candidates", () => {
        expect(findClosestMatch("anything", [])).toBeNull();
    });
});

describe("formatError", () => {
    it("formats a full error with all fields", () => {
        const error: FlowError = {
            severity: "error",
            file: "test.flow",
            line: 5,
            column: 1,
            message: 'I don\'t know what "Foo" is.',
            sourceLine: "    verify email using Foo",
            suggestion: 'Did you mean "FooBar"?',
            hint: "Every service must be declared in your services block.",
        };

        const output = formatError(error);
        expect(output).toContain("Error in test.flow, line 5:");
        expect(output).toContain("verify email using Foo");
        expect(output).toContain('I don\'t know what "Foo" is.');
        expect(output).toContain('Did you mean "FooBar"?');
        expect(output).toContain("Every service must be declared");
    });

    it("formats a warning", () => {
        const error: FlowError = {
            severity: "warning",
            file: "test.flow",
            line: 3,
            column: 1,
            message: "Variable might be unused.",
            sourceLine: "    set x to 5",
            suggestion: null,
            hint: null,
        };

        const output = formatError(error);
        expect(output).toContain("Warning in test.flow, line 3:");
    });

    it("omits suggestion and hint when null", () => {
        const error: FlowError = {
            severity: "error",
            file: "test.flow",
            line: 1,
            column: 1,
            message: "Unexpected token.",
            sourceLine: "???",
            suggestion: null,
            hint: null,
        };

        const output = formatError(error);
        const lines = output.split("\n").filter((l) => l.trim() !== "");
        expect(lines.length).toBe(3); // header, source line, message
    });
});

describe("createError", () => {
    it("extracts the correct source line", () => {
        const source = "line one\nline two\nline three";
        const error = createError("test.flow", 2, 1, "Something went wrong", source);

        expect(error.line).toBe(2);
        expect(error.sourceLine).toBe("line two");
        expect(error.severity).toBe("error");
        expect(error.suggestion).toBeNull();
    });

    it("accepts optional suggestion and hint", () => {
        const source = "only line";
        const error = createError("test.flow", 1, 1, "Bad", source, {
            suggestion: "Try this",
            hint: "Hint text",
            severity: "warning",
        });

        expect(error.suggestion).toBe("Try this");
        expect(error.hint).toBe("Hint text");
        expect(error.severity).toBe("warning");
    });
});
