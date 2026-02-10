import { Token, TokenType, FlowError } from "../types/index.js";
import { createError } from "../errors/index.js";

// ============================================================
// Keyword tables
// ============================================================

// Multi-word keywords, sorted longest-first for greedy matching
const COMPOUND_KEYWORDS = [
    "save the response headers as",
    "save the confidence as",
    "save the result as",
    "save the status as",
    "does not exist",
    "if still failing",
    "is not empty",
    "otherwise if",
    "divided by",
    "rounded to",
    "on failure",
    "on timeout",
    "is at least",
    "is at most",
    "is not",
    "is above",
    "is below",
    "is empty",
    "for each",
] as const;

const SINGLE_KEYWORDS = new Set([
    "workflow",
    "config",
    "services",
    "trigger",
    "step",
    "if",
    "otherwise",
    "for",
    "each",
    "in",
    "set",
    "to",
    "ask",
    "save",
    "the",
    "result",
    "as",
    "confidence",
    "using",
    "with",
    "at",
    "on",
    "is",
    "contains",
    "exists",
    "and",
    "or",
    "not",
    "complete",
    "reject",
    "log",
    "skip",
    "retry",
    "times",
    "waiting",
    "every",
    "when",
    "manual",
    "plus",
    "minus",
    "env",
]);

// ============================================================
// Lexer error class
// ============================================================

export class LexerError extends Error {
    public readonly flowError: FlowError;

    constructor(flowError: FlowError) {
        super(flowError.message);
        this.name = "LexerError";
        this.flowError = flowError;
    }
}

// ============================================================
// Tokenizer
// ============================================================

export function tokenize(source: string, fileName: string = "<input>"): Token[] {
    const tokens: Token[] = [];
    const indentStack: number[] = [0];
    let pos = 0;
    let line = 1;
    let column = 1;

    // Whether we're at the start of a line (need to check indentation)
    let atLineStart = true;

    function peek(): string {
        return source[pos] ?? "\0";
    }

    function peekAt(offset: number): string {
        return source[pos + offset] ?? "\0";
    }

    function advance(): string {
        const ch = source[pos] ?? "\0";
        pos++;
        if (ch === "\n") {
            line++;
            column = 1;
        } else {
            column++;
        }
        return ch;
    }

    function makeToken(type: TokenType, value: string, startLine: number, startCol: number): Token {
        return { type, value, line: startLine, column: startCol };
    }

    function error(message: string, suggestion?: string, hint?: string): LexerError {
        return new LexerError(createError(fileName, line, column, message, source, { suggestion, hint }));
    }

    // Check if the rest of the line (from pos) matches a string (case-insensitive for keywords)
    function matchAhead(text: string): boolean {
        for (let i = 0; i < text.length; i++) {
            const srcChar = source[pos + i];
            if (srcChar === undefined) return false;
            if (srcChar.toLowerCase() !== text[i]!.toLowerCase()) return false;
        }
        // The character after the match must be non-alphanumeric (word boundary)
        const afterChar = source[pos + text.length];
        if (afterChar !== undefined && /[a-zA-Z0-9_]/.test(afterChar)) return false;
        return true;
    }

    // --------------------------------------------------------
    // Indentation handling
    // --------------------------------------------------------

    function handleIndentation(): void {
        let spaces = 0;
        const indentStartLine = line;
        const indentStartCol = column;

        while (pos < source.length && peek() === " ") {
            advance();
            spaces++;
        }

        // Check for tabs
        if (peek() === "\t") {
            throw error(
                "Tabs are not allowed in Flow. Please use spaces (4 per indent level).",
                "Replace all tabs with 4 spaces.",
                "Most editors can convert tabs to spaces automatically.\nLook for \"Convert Indentation to Spaces\" in your editor's command palette."
            );
        }

        // Skip blank lines and comment-only lines
        if (peek() === "\n" || peek() === "\r" || peek() === "\0" || peek() === "#") {
            return;
        }

        const currentIndent = indentStack[indentStack.length - 1] ?? 0;

        if (spaces > currentIndent) {
            // Increased indentation
            if ((spaces - currentIndent) !== 4) {
                throw error(
                    `Unexpected indentation. I expected ${currentIndent + 4} spaces but found ${spaces}.`,
                    "Flow uses exactly 4 spaces for each indent level.",
                    "Make sure each nested block is indented exactly 4 more spaces than its parent."
                );
            }
            indentStack.push(spaces);
            tokens.push(makeToken(TokenType.INDENT, "INDENT", indentStartLine, indentStartCol));
        } else if (spaces < currentIndent) {
            // Decreased indentation — may need multiple DEDENTs
            while (indentStack.length > 1 && (indentStack[indentStack.length - 1] ?? 0) > spaces) {
                indentStack.pop();
                tokens.push(makeToken(TokenType.DEDENT, "DEDENT", indentStartLine, indentStartCol));
            }
            if ((indentStack[indentStack.length - 1] ?? 0) !== spaces) {
                throw error(
                    `Indentation doesn't match any outer block. Found ${spaces} spaces.`,
                    "Make sure your indentation lines up with a previous block.",
                    "Each indent level in Flow is exactly 4 spaces."
                );
            }
        }
        // If spaces === currentIndent, no INDENT/DEDENT needed
    }

    // --------------------------------------------------------
    // String scanning (with interpolation support)
    // --------------------------------------------------------

    function scanString(): void {
        const startLine = line;
        const startCol = column;
        advance(); // consume opening "

        let textBuffer = "";
        let hasInterpolation = false;

        while (pos < source.length && peek() !== '"') {
            if (peek() === "\n" || peek() === "\r") {
                throw error(
                    "This string is missing its closing quote.",
                    'Add a " at the end of the string.',
                    'Strings in Flow must be on a single line: "like this"'
                );
            }

            if (peek() === "{" && peekAt(1) !== "{") {
                // Start of interpolation
                hasInterpolation = true;

                // Emit accumulated text as STRING_PART
                if (textBuffer.length > 0 || !hasInterpolation) {
                    tokens.push(makeToken(TokenType.STRING_PART, textBuffer, startLine, startCol));
                } else {
                    tokens.push(makeToken(TokenType.STRING_PART, textBuffer, startLine, startCol));
                }
                textBuffer = "";

                tokens.push(makeToken(TokenType.INTERP_START, "{", line, column));
                advance(); // consume {

                // Tokenize the expression inside the interpolation
                scanInterpolationExpression();

                if (peek() !== "}") {
                    throw error(
                        "Missing closing } in string interpolation.",
                        "Add a } to close the interpolation expression.",
                        'Example: "Hello, {name}"'
                    );
                }
                tokens.push(makeToken(TokenType.INTERP_END, "}", line, column));
                advance(); // consume }
                continue;
            }

            if (peek() === "{" && peekAt(1) === "{") {
                // Escaped brace: {{ → literal {
                textBuffer += "{";
                advance();
                advance();
                continue;
            }

            if (peek() === "}" && peekAt(1) === "}") {
                // Escaped brace: }} → literal }
                textBuffer += "}";
                advance();
                advance();
                continue;
            }

            if (peek() === "\\") {
                advance(); // consume backslash
                const escaped = advance();
                switch (escaped) {
                    case "n": textBuffer += "\n"; break;
                    case "t": textBuffer += "\t"; break;
                    case '"': textBuffer += '"'; break;
                    case "\\": textBuffer += "\\"; break;
                    default: textBuffer += "\\" + escaped;
                }
                continue;
            }

            textBuffer += advance();
        }

        if (pos >= source.length) {
            throw error(
                "This string is missing its closing quote.",
                'Add a " at the end of the string.',
                'Strings in Flow must be on a single line: "like this"'
            );
        }

        advance(); // consume closing "

        if (hasInterpolation) {
            // Emit final STRING_PART
            tokens.push(makeToken(TokenType.STRING_PART, textBuffer, line, column));
        } else {
            // Plain string, no interpolation
            tokens.push(makeToken(TokenType.STRING, textBuffer, startLine, startCol));
        }
    }

    function scanInterpolationExpression(): void {
        // Inside {}, we scan identifiers and dots
        skipSpaces();
        if (peek() === "}") {
            throw error(
                "Empty interpolation expression.",
                "Put a variable name inside the braces.",
                'Example: "Hello, {name}"'
            );
        }

        const startLine = line;
        const startCol = column;
        let name = "";

        while (pos < source.length && /[a-zA-Z0-9_\-]/.test(peek())) {
            name += advance();
        }

        if (name.length === 0) {
            throw error(
                "Empty interpolation expression.",
                "Put a variable name inside the braces.",
                'Example: "Hello, {name}"'
            );
        }

        tokens.push(makeToken(TokenType.IDENTIFIER, name, startLine, startCol));

        // Handle dot access chains: {order.items.length}
        while (peek() === ".") {
            tokens.push(makeToken(TokenType.DOT, ".", line, column));
            advance(); // consume .

            const propLine = line;
            const propCol = column;
            let prop = "";
            while (pos < source.length && /[a-zA-Z0-9_\-]/.test(peek())) {
                prop += advance();
            }
            if (prop.length === 0) {
                throw error(
                    "Expected a property name after the dot.",
                    "Add a property name.",
                    'Example: {order.total}'
                );
            }
            tokens.push(makeToken(TokenType.IDENTIFIER, prop, propLine, propCol));
        }

        skipSpaces();
    }

    // --------------------------------------------------------
    // Number scanning
    // --------------------------------------------------------

    function scanNumber(): void {
        const startLine = line;
        const startCol = column;
        let num = "";

        while (pos < source.length && /[0-9]/.test(peek())) {
            num += advance();
        }

        if (peek() === "." && /[0-9]/.test(peekAt(1))) {
            num += advance(); // consume .
            while (pos < source.length && /[0-9]/.test(peek())) {
                num += advance();
            }
        }

        tokens.push(makeToken(TokenType.NUMBER, num, startLine, startCol));
    }

    // --------------------------------------------------------
    // Word scanning (identifiers and keywords)
    // --------------------------------------------------------

    function scanWord(): void {
        const startLine = line;
        const startCol = column;

        // Try to match compound keywords first (longest match)
        for (const compound of COMPOUND_KEYWORDS) {
            if (matchAhead(compound)) {
                // Consume the compound keyword
                for (let i = 0; i < compound.length; i++) {
                    advance();
                }
                tokens.push(makeToken(TokenType.KEYWORD_COMPOUND, compound, startLine, startCol));
                return;
            }
        }

        // Read the full word
        let word = "";
        while (pos < source.length && /[a-zA-Z0-9_\-]/.test(peek())) {
            word += advance();
        }

        // Check for boolean literals
        if (word === "true" || word === "false") {
            tokens.push(makeToken(TokenType.BOOLEAN, word, startLine, startCol));
            return;
        }

        // Check for single keywords
        if (SINGLE_KEYWORDS.has(word)) {
            tokens.push(makeToken(TokenType.KEYWORD, word, startLine, startCol));
            return;
        }

        // Otherwise it's an identifier
        tokens.push(makeToken(TokenType.IDENTIFIER, word, startLine, startCol));
    }

    // --------------------------------------------------------
    // Helpers
    // --------------------------------------------------------

    function skipSpaces(): void {
        while (pos < source.length && peek() === " ") {
            advance();
        }
    }

    function skipComment(): void {
        while (pos < source.length && peek() !== "\n") {
            advance();
        }
    }

    // --------------------------------------------------------
    // Main loop
    // --------------------------------------------------------

    while (pos < source.length) {
        // Handle start of line (indentation)
        if (atLineStart) {
            handleIndentation();
            atLineStart = false;

            // After indentation, if we hit end of line or comment, skip
            if (peek() === "\n" || peek() === "\r") {
                if (peek() === "\r") advance();
                if (peek() === "\n") advance();
                atLineStart = true;
                continue;
            }
            if (peek() === "#") {
                skipComment();
                continue;
            }
            if (peek() === "\0") {
                break;
            }
        }

        const ch = peek();

        // Whitespace (within a line)
        if (ch === " ") {
            skipSpaces();
            continue;
        }

        // Newlines
        if (ch === "\n" || ch === "\r") {
            const newlineLine = line;
            const newlineCol = column;
            if (ch === "\r") advance();
            if (peek() === "\n") advance();

            // Only emit NEWLINE if the last token isn't already NEWLINE
            const lastToken = tokens[tokens.length - 1];
            if (lastToken && lastToken.type !== TokenType.NEWLINE && lastToken.type !== TokenType.INDENT) {
                tokens.push(makeToken(TokenType.NEWLINE, "\\n", newlineLine, newlineCol));
            }
            atLineStart = true;
            continue;
        }

        // Comments
        if (ch === "#") {
            skipComment();
            continue;
        }

        // Strings
        if (ch === '"') {
            scanString();
            continue;
        }

        // Numbers
        if (/[0-9]/.test(ch)) {
            scanNumber();
            continue;
        }

        // Colon
        if (ch === ":") {
            tokens.push(makeToken(TokenType.COLON, ":", line, column));
            advance();
            continue;
        }

        // Dot (standalone, not in a number)
        if (ch === ".") {
            tokens.push(makeToken(TokenType.DOT, ".", line, column));
            advance();
            continue;
        }

        // Words (identifiers, keywords, booleans)
        if (/[a-zA-Z_]/.test(ch)) {
            scanWord();
            continue;
        }

        // Unknown character
        throw error(
            `Unexpected character "${ch}".`,
            "Remove this character or check for typos.",
            "Flow only uses letters, numbers, spaces, quotes, colons, dots, and # for comments."
        );
    }

    // Emit remaining DEDENTs at end of file
    while (indentStack.length > 1) {
        indentStack.pop();
        tokens.push(makeToken(TokenType.DEDENT, "DEDENT", line, column));
    }

    tokens.push(makeToken(TokenType.EOF, "", line, column));

    return tokens;
}
