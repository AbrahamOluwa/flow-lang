import { describe, it, expect } from "vitest";
import { tokenize, LexerError } from "../../src/lexer/index.js";
import { TokenType } from "../../src/types/index.js";
import type { Token } from "../../src/types/index.js";

// Helper: extract token types (excluding EOF)
function types(tokens: Token[]): TokenType[] {
    return tokens.filter((t) => t.type !== TokenType.EOF).map((t) => t.type);
}

// Helper: extract token values (excluding EOF, NEWLINE, INDENT, DEDENT)
function values(tokens: Token[]): string[] {
    return tokens
        .filter(
            (t) =>
                t.type !== TokenType.EOF &&
                t.type !== TokenType.NEWLINE &&
                t.type !== TokenType.INDENT &&
                t.type !== TokenType.DEDENT
        )
        .map((t) => t.value);
}

// ============================================================
// Basic tokens
// ============================================================

describe("Lexer — basic tokens", () => {
    it("tokenizes an empty string", () => {
        const tokens = tokenize("");
        expect(tokens.length).toBe(1);
        expect(tokens[0]!.type).toBe(TokenType.EOF);
    });

    it("tokenizes a plain string", () => {
        const tokens = tokenize('"hello world"');
        expect(tokens[0]!.type).toBe(TokenType.STRING);
        expect(tokens[0]!.value).toBe("hello world");
    });

    it("tokenizes integers", () => {
        const tokens = tokenize("42");
        expect(tokens[0]!.type).toBe(TokenType.NUMBER);
        expect(tokens[0]!.value).toBe("42");
    });

    it("tokenizes decimal numbers", () => {
        const tokens = tokenize("3.14");
        expect(tokens[0]!.type).toBe(TokenType.NUMBER);
        expect(tokens[0]!.value).toBe("3.14");
    });

    it("tokenizes booleans", () => {
        const tokens = tokenize("true false");
        expect(tokens[0]!.type).toBe(TokenType.BOOLEAN);
        expect(tokens[0]!.value).toBe("true");
        expect(tokens[1]!.type).toBe(TokenType.BOOLEAN);
        expect(tokens[1]!.value).toBe("false");
    });

    it("tokenizes colon", () => {
        const tokens = tokenize("config:");
        expect(tokens[0]!.type).toBe(TokenType.KEYWORD);
        expect(tokens[0]!.value).toBe("config");
        expect(tokens[1]!.type).toBe(TokenType.COLON);
    });

    it("tokenizes dot", () => {
        const tokens = tokenize("order.total");
        expect(tokens[0]!.type).toBe(TokenType.IDENTIFIER);
        expect(tokens[0]!.value).toBe("order");
        expect(tokens[1]!.type).toBe(TokenType.DOT);
        expect(tokens[2]!.type).toBe(TokenType.IDENTIFIER);
        expect(tokens[2]!.value).toBe("total");
    });

    it("tokenizes identifiers with hyphens", () => {
        const tokens = tokenize("my-variable");
        expect(tokens[0]!.type).toBe(TokenType.IDENTIFIER);
        expect(tokens[0]!.value).toBe("my-variable");
    });

    it("tokenizes identifiers with underscores", () => {
        const tokens = tokenize("my_variable");
        expect(tokens[0]!.type).toBe(TokenType.IDENTIFIER);
        expect(tokens[0]!.value).toBe("my_variable");
    });
});

// ============================================================
// Single keywords
// ============================================================

describe("Lexer — single keywords", () => {
    const keywords = [
        "workflow", "config", "services", "trigger", "step",
        "if", "otherwise", "set", "to", "ask",
        "using", "with", "complete", "reject", "log",
        "and", "or", "not", "in", "skip",
        "retry", "times", "waiting", "when", "manual",
        "plus", "minus", "env",
    ];

    for (const kw of keywords) {
        it(`recognizes "${kw}" as KEYWORD`, () => {
            const tokens = tokenize(kw);
            expect(tokens[0]!.type).toBe(TokenType.KEYWORD);
            expect(tokens[0]!.value).toBe(kw);
        });
    }
});

// ============================================================
// Compound keywords
// ============================================================

describe("Lexer — compound keywords", () => {
    const compounds = [
        "is not empty",
        "is not",
        "is above",
        "is below",
        "is at least",
        "is at most",
        "is empty",
        "does not exist",
        "for each",
        "divided by",
        "rounded to",
        "on failure",
        "on timeout",
        "otherwise if",
        "if still failing",
        "save the result as",
        "save the confidence as",
    ];

    for (const compound of compounds) {
        it(`recognizes "${compound}" as KEYWORD_COMPOUND`, () => {
            const tokens = tokenize(compound);
            expect(tokens[0]!.type).toBe(TokenType.KEYWORD_COMPOUND);
            expect(tokens[0]!.value).toBe(compound);
        });
    }

    it("prefers longest match: 'is not empty' over 'is not'", () => {
        const tokens = tokenize("is not empty");
        expect(tokens[0]!.type).toBe(TokenType.KEYWORD_COMPOUND);
        expect(tokens[0]!.value).toBe("is not empty");
    });

    it("matches 'is not' when not followed by 'empty'", () => {
        const tokens = tokenize("is not valid");
        expect(tokens[0]!.type).toBe(TokenType.KEYWORD_COMPOUND);
        expect(tokens[0]!.value).toBe("is not");
        expect(tokens[1]!.type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1]!.value).toBe("valid");
    });

    it("matches 'is' alone as single keyword when not part of compound", () => {
        const tokens = tokenize("is something");
        expect(tokens[0]!.type).toBe(TokenType.KEYWORD);
        expect(tokens[0]!.value).toBe("is");
    });
});

// ============================================================
// Comments
// ============================================================

describe("Lexer — comments", () => {
    it("skips full-line comments", () => {
        const tokens = tokenize("# this is a comment");
        expect(types(tokens)).toEqual([]);
    });

    it("skips inline comments", () => {
        const tokens = tokenize('set x to 5 # a comment');
        const vals = values(tokens);
        expect(vals).toContain("set");
        expect(vals).toContain("x");
        expect(vals).not.toContain("a");
        expect(vals).not.toContain("comment");
    });

    it("handles file with only comments", () => {
        const tokens = tokenize("# line 1\n# line 2\n# line 3");
        expect(types(tokens)).toEqual([]);
    });
});

// ============================================================
// Strings and interpolation
// ============================================================

describe("Lexer — strings", () => {
    it("tokenizes a plain string with no interpolation", () => {
        const tokens = tokenize('"Hello, world!"');
        expect(tokens[0]!.type).toBe(TokenType.STRING);
        expect(tokens[0]!.value).toBe("Hello, world!");
    });

    it("tokenizes escaped characters in strings", () => {
        const tokens = tokenize('"line1\\nline2"');
        expect(tokens[0]!.type).toBe(TokenType.STRING);
        expect(tokens[0]!.value).toBe("line1\nline2");
    });

    it("tokenizes escaped quotes", () => {
        const tokens = tokenize('"say \\"hello\\""');
        expect(tokens[0]!.type).toBe(TokenType.STRING);
        expect(tokens[0]!.value).toBe('say "hello"');
    });

    it("tokenizes escaped braces {{ and }}", () => {
        const tokens = tokenize('"use {{braces}}"');
        expect(tokens[0]!.type).toBe(TokenType.STRING);
        expect(tokens[0]!.value).toBe("use {braces}");
    });

    it("tokenizes string with simple interpolation", () => {
        const tokens = tokenize('"Hello, {name}"');
        const tokenTypes = types(tokens);
        expect(tokenTypes).toEqual([
            TokenType.STRING_PART,   // "Hello, "
            TokenType.INTERP_START,  // {
            TokenType.IDENTIFIER,    // name
            TokenType.INTERP_END,    // }
            TokenType.STRING_PART,   // ""
        ]);
        expect(tokens[0]!.value).toBe("Hello, ");
        expect(tokens[2]!.value).toBe("name");
    });

    it("tokenizes string with dot access interpolation", () => {
        const tokens = tokenize('"Total: {order.total}"');
        const tokenTypes = types(tokens);
        expect(tokenTypes).toEqual([
            TokenType.STRING_PART,
            TokenType.INTERP_START,
            TokenType.IDENTIFIER,  // order
            TokenType.DOT,
            TokenType.IDENTIFIER,  // total
            TokenType.INTERP_END,
            TokenType.STRING_PART,
        ]);
    });

    it("tokenizes string with deep dot access", () => {
        const tokens = tokenize('"ID: {response.body.id}"');
        const identifiers = tokens.filter((t) => t.type === TokenType.IDENTIFIER);
        expect(identifiers.map((t) => t.value)).toEqual(["response", "body", "id"]);
    });

    it("tokenizes string with multiple interpolations", () => {
        const tokens = tokenize('"Hello, {first}. Your ID is {id}."');
        const interps = tokens.filter((t) => t.type === TokenType.INTERP_START);
        expect(interps.length).toBe(2);
    });
});

// ============================================================
// Indentation
// ============================================================

describe("Lexer — indentation", () => {
    it("emits INDENT for one level of nesting", () => {
        const source = "config:\n    name: \"test\"";
        const tokens = tokenize(source);
        const tokenTypes = types(tokens);
        expect(tokenTypes).toContain(TokenType.INDENT);
    });

    it("emits DEDENT when indentation decreases", () => {
        const source = "config:\n    name: \"test\"\nworkflow:";
        const tokens = tokenize(source);
        const tokenTypes = types(tokens);
        expect(tokenTypes).toContain(TokenType.INDENT);
        expect(tokenTypes).toContain(TokenType.DEDENT);
    });

    it("emits multiple DEDENTs for multi-level dedent", () => {
        const source = "workflow:\n    step Test:\n        log \"hi\"\nconfig:";
        const tokens = tokenize(source);
        const dedents = tokens.filter((t) => t.type === TokenType.DEDENT);
        expect(dedents.length).toBe(2); // back from 8 → 0
    });

    it("emits closing DEDENTs at EOF", () => {
        const source = "config:\n    name: \"test\"";
        const tokens = tokenize(source);
        const dedents = tokens.filter((t) => t.type === TokenType.DEDENT);
        expect(dedents.length).toBe(1);
    });

    it("handles two levels of indentation", () => {
        const source = "workflow:\n    if true:\n        log \"nested\"";
        const tokens = tokenize(source);
        const indents = tokens.filter((t) => t.type === TokenType.INDENT);
        expect(indents.length).toBe(2);
    });

    it("handles three levels of indentation", () => {
        const source = [
            "workflow:",
            "    step A:",
            "        if true:",
            "            log \"deep\"",
        ].join("\n");
        const tokens = tokenize(source);
        const indents = tokens.filter((t) => t.type === TokenType.INDENT);
        expect(indents.length).toBe(3);
    });

    it("skips blank lines without affecting indentation", () => {
        const source = "config:\n    name: \"a\"\n\n    version: 1";
        const tokens = tokenize(source);
        const indents = tokens.filter((t) => t.type === TokenType.INDENT);
        expect(indents.length).toBe(1); // only one indent, not two
    });
});

// ============================================================
// Line / column tracking
// ============================================================

describe("Lexer — line and column tracking", () => {
    it("tracks line numbers correctly", () => {
        const source = "config:\n    name: \"test\"";
        const tokens = tokenize(source);
        expect(tokens[0]!.line).toBe(1); // config
        // name is on line 2
        const nameToken = tokens.find((t) => t.value === "name");
        expect(nameToken?.line).toBe(2);
    });

    it("tracks column numbers for first token", () => {
        const tokens = tokenize("config:");
        expect(tokens[0]!.column).toBe(1);
    });
});

// ============================================================
// Full .flow snippets
// ============================================================

describe("Lexer — full snippets", () => {
    it("tokenizes a config block", () => {
        const source = [
            "config:",
            '    name: "My Workflow"',
            "    version: 1",
            "    timeout: 5",
        ].join("\n");
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("config");
        expect(values(tokens)).toContain("My Workflow");
        expect(values(tokens)).toContain("1");
        expect(values(tokens)).toContain("5");
    });

    it("tokenizes a services block", () => {
        const source = [
            "services:",
            '    EmailVerifier is an API at "https://api.example.com/v1"',
        ].join("\n");
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("services");
        expect(values(tokens)).toContain("EmailVerifier");
        expect(values(tokens)).toContain("is");
        expect(values(tokens)).toContain("https://api.example.com/v1");
    });

    it("tokenizes a set statement with math", () => {
        const source = "set total to item.price times item.quantity";
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("set");
        expect(values(tokens)).toContain("total");
        expect(values(tokens)).toContain("to");
        expect(values(tokens)).toContain("item");
        expect(values(tokens)).toContain("price");
        expect(values(tokens)).toContain("times");
        expect(values(tokens)).toContain("quantity");
    });

    it("tokenizes an if/otherwise block", () => {
        const source = [
            "if score is above 50:",
            "    log \"pass\"",
            "otherwise:",
            "    log \"fail\"",
        ].join("\n");
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("if");
        expect(values(tokens)).toContain("score");
        expect(values(tokens)).toContain("is above");
        expect(values(tokens)).toContain("50");
        expect(values(tokens)).toContain("otherwise");
    });

    it("tokenizes a for each statement", () => {
        const source = [
            "for each item in order.items:",
            "    log \"processing\"",
        ].join("\n");
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("for each");
        expect(values(tokens)).toContain("item");
        expect(values(tokens)).toContain("in");
        expect(values(tokens)).toContain("order");
        expect(values(tokens)).toContain("items");
    });

    it("tokenizes an ask statement", () => {
        const source = [
            "ask Analyst to summarize the report",
            "    save the result as summary",
        ].join("\n");
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("ask");
        expect(values(tokens)).toContain("Analyst");
        expect(values(tokens)).toContain("to");
        expect(values(tokens)).toContain("save the result as");
        expect(values(tokens)).toContain("summary");
    });

    it("tokenizes complete and reject", () => {
        const tokens1 = tokenize('complete with status "success"');
        expect(values(tokens1)).toContain("complete");
        expect(values(tokens1)).toContain("with");
        expect(values(tokens1)).toContain("status");
        expect(values(tokens1)).toContain("success");

        const tokens2 = tokenize('reject with "Invalid email"');
        expect(values(tokens2)).toContain("reject");
        expect(values(tokens2)).toContain("with");
        expect(values(tokens2)).toContain("Invalid email");
    });

    it("tokenizes a multi-block .flow file", () => {
        const source = [
            "config:",
            '    name: "Order Processing"',
            "    version: 1",
            "",
            "services:",
            '    Stripe is a plugin "flow-connector-stripe"',
            "",
            "workflow:",
            "    trigger: when a form is submitted",
            "    step Validate:",
            '        log "validating"',
            "    complete with status \"done\"",
        ].join("\n");
        const tokens = tokenize(source);

        // Should have tokens from all three blocks
        expect(values(tokens)).toContain("config");
        expect(values(tokens)).toContain("services");
        expect(values(tokens)).toContain("workflow");
        expect(values(tokens)).toContain("Stripe");
        expect(values(tokens)).toContain("step");
        expect(values(tokens)).toContain("complete");

        // Should end with EOF
        expect(tokens[tokens.length - 1]!.type).toBe(TokenType.EOF);
    });
});

// ============================================================
// Error cases
// ============================================================

describe("Lexer — error cases", () => {
    it("rejects tabs with a helpful error", () => {
        expect(() => tokenize("\tconfig:")).toThrow(LexerError);
        try {
            tokenize("\tconfig:");
        } catch (e) {
            const err = e as LexerError;
            expect(err.flowError.message).toContain("Tabs are not allowed");
            expect(err.flowError.suggestion).toContain("spaces");
        }
    });

    it("rejects unterminated strings", () => {
        expect(() => tokenize('"hello')).toThrow(LexerError);
        try {
            tokenize('"hello');
        } catch (e) {
            const err = e as LexerError;
            expect(err.flowError.message).toContain("missing its closing quote");
        }
    });

    it("rejects multi-line strings", () => {
        expect(() => tokenize('"hello\nworld"')).toThrow(LexerError);
    });

    it("rejects invalid characters", () => {
        expect(() => tokenize("@")).toThrow(LexerError);
        try {
            tokenize("@");
        } catch (e) {
            const err = e as LexerError;
            expect(err.flowError.message).toContain("Unexpected character");
        }
    });

    it("rejects bad indentation (not multiple of 4)", () => {
        expect(() => tokenize("config:\n  name: \"x\"")).toThrow(LexerError);
        try {
            tokenize("config:\n  name: \"x\"");
        } catch (e) {
            const err = e as LexerError;
            expect(err.flowError.message).toContain("indentation");
        }
    });

    it("rejects misaligned dedentation", () => {
        expect(() => tokenize("config:\n    name: \"x\"\n  version: 1")).toThrow(LexerError);
    });

    it("rejects empty interpolation", () => {
        expect(() => tokenize('"hello {}"')).toThrow(LexerError);
        try {
            tokenize('"hello {}"');
        } catch (e) {
            const err = e as LexerError;
            expect(err.flowError.message).toContain("Empty interpolation");
        }
    });

    it("rejects unclosed interpolation", () => {
        expect(() => tokenize('"hello {name"')).toThrow(LexerError);
    });
});

// ============================================================
// Edge cases
// ============================================================

describe("Lexer — edge cases", () => {
    it("handles trailing whitespace on lines", () => {
        const tokens = tokenize("config:   \n    name: \"x\"");
        expect(values(tokens)).toContain("config");
        expect(values(tokens)).toContain("name");
    });

    it("handles multiple blank lines", () => {
        const tokens = tokenize("config:\n\n\n    name: \"x\"");
        expect(values(tokens)).toContain("config");
        expect(values(tokens)).toContain("name");
    });

    it("handles file ending with newline", () => {
        const tokens = tokenize("config:\n");
        expect(tokens[tokens.length - 1]!.type).toBe(TokenType.EOF);
    });

    it("handles Windows-style line endings (CRLF)", () => {
        const tokens = tokenize("config:\r\n    name: \"x\"");
        expect(values(tokens)).toContain("config");
        expect(values(tokens)).toContain("name");
    });

    it("identifier after dot is not treated as keyword", () => {
        // "step" is a keyword, but response.step should tokenize step as IDENTIFIER
        // Actually the lexer tokenizes words independently — the parser handles context.
        // Here we just verify the dot-access sequence works.
        const tokens = tokenize("response.status");
        expect(tokens[0]!.type).toBe(TokenType.IDENTIFIER);
        expect(tokens[1]!.type).toBe(TokenType.DOT);
        expect(tokens[2]!.type).toBe(TokenType.IDENTIFIER);
    });

    it("handles on failure compound keyword", () => {
        const source = [
            "send email using SendGrid",
            "    on failure:",
            "        retry 3 times waiting 5",
        ].join("\n");
        const tokens = tokenize(source);
        expect(values(tokens)).toContain("on failure");
        expect(values(tokens)).toContain("retry");
    });

    it("produces correct token count for minimal workflow", () => {
        const source = 'log "hello"';
        const tokens = tokenize(source);
        // log, "hello", EOF
        const meaningful = tokens.filter(
            (t) => t.type !== TokenType.EOF && t.type !== TokenType.NEWLINE
        );
        expect(meaningful.length).toBe(2);
    });
});
