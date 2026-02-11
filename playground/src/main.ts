import "./styles.css";
import { createEditor, monaco } from "./editor.js";
import { EXAMPLES } from "./examples.js";
import { runFlow } from "./runner.js";
import type { RunResult } from "./runner.js";
import type { LogEntry } from "@flow/types/index.js";

// --- Initialize editor ---
const container = document.getElementById("editor-container")!;
const editor = createEditor(container, EXAMPLES[0]!.code);

// --- Input textarea ---
const inputTextarea = document.getElementById("input-json") as HTMLTextAreaElement;
inputTextarea.value = EXAMPLES[0]!.input;

// --- Populate examples dropdown ---
const select = document.getElementById("example-select") as HTMLSelectElement;
EXAMPLES.forEach((ex, i) => {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = ex.name;
    if (i === 0) option.selected = true;
    select.appendChild(option);
});

select.addEventListener("change", () => {
    const idx = parseInt(select.value, 10);
    const example = EXAMPLES[idx];
    if (example) {
        editor.setValue(example.code);
        inputTextarea.value = example.input;
    }
});

// --- Tab switching ---
const tabs = document.querySelectorAll<HTMLButtonElement>(".tab");
const tabContents = document.querySelectorAll<HTMLDivElement>(".tab-content");

function switchTab(target: string): void {
    tabs.forEach(t => t.classList.remove("active"));
    tabContents.forEach(tc => tc.classList.remove("active"));
    document.querySelector(`[data-tab="${target}"]`)?.classList.add("active");
    document.getElementById(`tab-${target}`)?.classList.add("active");
}

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        const target = tab.dataset["tab"];
        if (target) switchTab(target);
    });
});

// --- Run button ---
const btnRun = document.getElementById("btn-run")!;
const outputContent = document.getElementById("output-content")!;
const logContent = document.getElementById("log-content")!;

async function run(): Promise<void> {
    btnRun.textContent = "Running...";
    btnRun.setAttribute("disabled", "true");
    outputContent.innerHTML = '<span class="output-muted">Running...</span>';
    logContent.innerHTML = "";

    switchTab("output");

    try {
        const source = editor.getValue();
        const input = inputTextarea.value;
        const result = await runFlow(source, input);
        renderOutput(result);
        renderLog(result.logs);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        outputContent.innerHTML = `<span class="output-error">Unexpected error: ${escapeHtml(msg)}</span>`;
    } finally {
        btnRun.innerHTML = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5v11l9-5.5L3 1.5z" fill="currentColor"/></svg> Run';
        btnRun.removeAttribute("disabled");
    }
}

btnRun.addEventListener("click", run);

// Ctrl/Cmd + Enter to run
editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    run();
});

// --- Render output ---
function renderOutput(result: RunResult): void {
    let html = "";

    if (result.status === "completed") {
        html += '<span class="output-success">Workflow completed successfully.</span>\n';
        if (result.outputData && Object.keys(result.outputData).length > 0) {
            html += '\n<span class="output-label">Outputs:</span>\n';
            for (const [key, value] of Object.entries(result.outputData)) {
                html += `  <span class="output-key">${escapeHtml(key)}</span>: ${escapeHtml(formatValue(value))}\n`;
            }
        }
    } else if (result.status === "rejected") {
        html += `<span class="output-rejected">Workflow rejected:</span> ${escapeHtml(result.rejectionMessage ?? "")}\n`;
    } else {
        html += `<span class="output-error">${escapeHtml(result.output)}</span>`;
    }

    const warnings = result.errors.filter(e => e.severity === "warning");
    if (warnings.length > 0) {
        html += '\n<span class="output-warning">Warnings:</span>\n';
        for (const w of warnings) {
            html += `  ${escapeHtml(w.message)}\n`;
        }
    }

    outputContent.innerHTML = html;
}

// --- Render log ---
function renderLog(logs: LogEntry[]): void {
    if (logs.length === 0) {
        logContent.innerHTML = '<span class="log-empty">No log entries.</span>';
        return;
    }

    let html = "";
    for (const entry of logs) {
        const icon = entry.result === "success" ? "+" : entry.result === "failure" ? "x" : "-";
        const cls = entry.result === "success" ? "log-success" : entry.result === "failure" ? "log-failure" : "log-skipped";
        const duration = entry.durationMs !== null ? ` <span class="log-duration">(${entry.durationMs}ms)</span>` : "";
        const step = entry.step ? `<span class="log-step">[${escapeHtml(entry.step)}]</span> ` : "";

        html += `<span class="${cls}">[${icon}]</span> ${step}${escapeHtml(entry.action)}${duration}`;

        if (entry.action === "log" && entry.details["message"]) {
            html += ` <span class="log-message">— ${escapeHtml(String(entry.details["message"]))}</span>`;
        }
        html += "\n";
    }
    logContent.innerHTML = html;
}

// --- Share button ---
const btnShare = document.getElementById("btn-share")!;

btnShare.addEventListener("click", () => {
    const data = {
        code: editor.getValue(),
        input: inputTextarea.value,
    };
    const hash = btoa(encodeURIComponent(JSON.stringify(data)));
    const url = `${window.location.origin}${window.location.pathname}#${hash}`;

    navigator.clipboard.writeText(url).then(() => {
        showToast("Link copied to clipboard");
    }).catch(() => {
        // Fallback: update URL without clipboard
        window.location.hash = hash;
        showToast("Share link updated in URL bar");
    });
});

// --- Load from URL hash ---
function loadFromHash(): void {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    try {
        const decoded = decodeURIComponent(atob(hash));
        const data = JSON.parse(decoded) as { code?: string; input?: string };
        if (data.code) {
            editor.setValue(data.code);
            select.value = "";
        }
        if (data.input) inputTextarea.value = data.input;
    } catch {
        // Ignore invalid hash
    }
}

loadFromHash();

// --- Gutter resize ---
const gutter = document.getElementById("gutter")!;
const app = document.getElementById("app")!;
let isResizing = false;

gutter.addEventListener("mousedown", (e) => {
    isResizing = true;
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const fraction = e.clientX / window.innerWidth;
    const clamped = Math.max(0.2, Math.min(0.8, fraction));
    app.style.gridTemplateColumns = `${clamped}fr 4px ${1 - clamped}fr`;
});

document.addEventListener("mouseup", () => {
    isResizing = false;
});

// --- Toast notification ---
function showToast(message: string): void {
    let toast = document.querySelector(".toast") as HTMLElement | null;
    if (!toast) {
        toast = document.createElement("div");
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => toast!.classList.remove("visible"), 2000);
}

// --- Helpers ---
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function formatValue(value: unknown): string {
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
}
