import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";

self.MonacoEnvironment = {
    getWorker(): Worker {
        return new editorWorker();
    },
};

// Register Flow language
monaco.languages.register({ id: "flow" });

// Monarch tokenizer for syntax highlighting
monaco.languages.setMonarchTokensProvider("flow", {
    keywords: [
        "workflow", "config", "services", "trigger", "step",
        "if", "otherwise", "set", "to", "ask", "save", "the",
        "result", "as", "confidence", "using", "with", "at",
        "on", "is", "contains", "exists", "and", "or", "not",
        "complete", "reject", "log", "skip", "retry", "times",
        "waiting", "every", "when", "manual", "plus", "minus",
        "for", "each", "in", "env", "failure", "timeout",
        "still", "failing", "above", "below", "empty",
        "does", "status", "response", "headers",
    ],
    typeKeywords: ["API", "AI", "plugin", "webhook"],

    tokenizer: {
        root: [
            // Comments
            [/#.*$/, "comment"],

            // Strings with interpolation
            [/"/, { token: "string.quote", bracket: "@open", next: "@string" }],

            // Numbers
            [/\b\d+(\.\d+)?\b/, "number"],

            // Booleans
            [/\b(true|false)\b/, "constant"],

            // Service type keywords
            [/\b(API|AI|plugin|webhook)\b/, "type"],

            // Colon at end of line (block opener)
            [/:/, "delimiter"],

            // Dot access
            [/\./, "delimiter.dot"],

            // Identifiers and keywords
            [/[a-zA-Z_][a-zA-Z0-9_-]*/, {
                cases: {
                    "@keywords": "keyword",
                    "@typeKeywords": "type",
                    "@default": "identifier",
                },
            }],
        ],
        string: [
            [/\{/, { token: "delimiter.bracket", next: "@interpolation" }],
            [/[^"\\{]+/, "string"],
            [/\\./, "string.escape"],
            [/"/, { token: "string.quote", bracket: "@close", next: "@pop" }],
        ],
        interpolation: [
            [/[a-zA-Z_][a-zA-Z0-9_.\-]*/, "variable"],
            [/\}/, { token: "delimiter.bracket", next: "@pop" }],
        ],
    },
});

// Dark theme matching the Flow landing page
monaco.editor.defineTheme("flow-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
        { token: "keyword", foreground: "818cf8", fontStyle: "bold" },
        { token: "type", foreground: "a78bfa" },
        { token: "string", foreground: "4ade80" },
        { token: "string.quote", foreground: "4ade80" },
        { token: "string.escape", foreground: "6ee7b7" },
        { token: "number", foreground: "fbbf24" },
        { token: "constant", foreground: "fbbf24" },
        { token: "comment", foreground: "71717a", fontStyle: "italic" },
        { token: "identifier", foreground: "f4f4f5" },
        { token: "variable", foreground: "22d3ee" },
        { token: "delimiter", foreground: "a1a1aa" },
        { token: "delimiter.dot", foreground: "a1a1aa" },
        { token: "delimiter.bracket", foreground: "fbbf24" },
    ],
    colors: {
        "editor.background": "#111113",
        "editor.foreground": "#f4f4f5",
        "editorCursor.foreground": "#818cf8",
        "editor.lineHighlightBackground": "#1c1c1f",
        "editorLineNumber.foreground": "#3a3a3e",
        "editorLineNumber.activeForeground": "#71717a",
        "editor.selectionBackground": "#6366f133",
        "editor.inactiveSelectionBackground": "#6366f11a",
    },
});

export function createEditor(
    container: HTMLElement,
    initialValue: string,
): monaco.editor.IStandaloneCodeEditor {
    return monaco.editor.create(container, {
        value: initialValue,
        language: "flow",
        theme: "flow-dark",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: 14,
        lineHeight: 24,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        padding: { top: 16, bottom: 16 },
        tabSize: 4,
        insertSpaces: true,
        automaticLayout: true,
        wordWrap: "on",
        renderLineHighlight: "line",
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        smoothScrolling: true,
    });
}

export { monaco };
