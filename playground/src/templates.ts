// --- Template Builder ---
// Modal-based template builder with 5 workflow templates.
// Each template defines form fields and a generate() function that produces
// valid .flow code and sample input JSON.

interface TemplateField {
    id: string;
    label: string;
    type: "text" | "select" | "textarea";
    placeholder: string;
    defaultValue: string;
    options?: string[];
    helpText?: string;
}

interface GeneratedCode {
    code: string;
    input: string;
}

interface Template {
    id: string;
    name: string;
    description: string;
    iconColor: string;
    iconPath: string;
    fields: TemplateField[];
    generate: (values: Record<string, string>) => GeneratedCode;
}

// --- Helpers ---

function sanitizeId(raw: string): string {
    return raw.trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "")
        .replace(/^-+|-+$/g, "")
        || "value";
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function isNumeric(val: string): boolean {
    return val.trim() !== "" && !isNaN(Number(val));
}

// --- Template Definitions ---

const TEMPLATES: Template[] = [
    // 1. API Integration
    {
        id: "api-integration",
        name: "API Integration",
        description: "Call an external API, save the result, and output data",
        iconColor: "#22D3EE",
        iconPath: "M2 4a2 2 0 012-2h8a2 2 0 012 2v1h2a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm10 1V4H4v3h8V5zm-8 5v4h12V7H4v3z",
        fields: [
            { id: "workflowName", label: "Workflow name", type: "text", placeholder: "My API Workflow", defaultValue: "API Lookup", helpText: "A human-readable name for this workflow" },
            { id: "serviceName", label: "Service name", type: "text", placeholder: "GitHub, Stripe, etc.", defaultValue: "MyAPI", helpText: "What you call this service in your workflow" },
            { id: "apiUrl", label: "API base URL", type: "text", placeholder: "https://api.example.com", defaultValue: "https://api.example.com" },
            { id: "verb", label: "Action", type: "select", placeholder: "", defaultValue: "get", options: ["get", "create", "send", "update", "delete"] },
            { id: "description", label: "What to fetch", type: "text", placeholder: "user profile, order, etc.", defaultValue: "data", helpText: "Describes what the API call does" },
            { id: "path", label: "API path", type: "text", placeholder: "/users/123", defaultValue: "/endpoint" },
            { id: "outputName", label: "Output field name", type: "text", placeholder: "response, data, etc.", defaultValue: "result" },
        ],
        generate(v) {
            const name = v["workflowName"] || "API Lookup";
            const svc = v["serviceName"] || "MyAPI";
            const url = v["apiUrl"] || "https://api.example.com";
            const verb = v["verb"] || "get";
            const desc = v["description"] || "data";
            const path = v["path"] || "/endpoint";
            const output = sanitizeId(v["outputName"] || "result");

            const code = `# ${name}
# Generated from the API Integration template.

config:
    name: "${name}"
    version: 1

services:
    ${svc} is an API at "${url}"

workflow:
    trigger: when a request is received

    ${verb} ${desc} using ${svc} at "${path}"
        save the result as ${output}

    log "Received response from ${svc}"

    complete with ${output} ${output}
`;
            return { code, input: "{}" };
        },
    },

    // 2. Conditional Logic
    {
        id: "conditional-logic",
        name: "Conditional Logic",
        description: "Check a value and take different paths based on the result",
        iconColor: "#FBBF24",
        iconPath: "M8 1l7 4v6l-7 4-7-4V5l7-4zm0 2.2L3.5 5.5v4.1L8 12.8l4.5-3.2V5.5L8 3.2z",
        fields: [
            { id: "workflowName", label: "Workflow name", type: "text", placeholder: "My Conditional Workflow", defaultValue: "Decision Maker" },
            { id: "inputField", label: "Input field to check", type: "text", placeholder: "score, status, amount, etc.", defaultValue: "value", helpText: "The field from the request to evaluate" },
            { id: "condition", label: "Condition", type: "select", placeholder: "", defaultValue: "is above", options: ["is", "is not", "is above", "is below", "is at least", "is at most", "contains"] },
            { id: "threshold", label: "Threshold or expected value", type: "text", placeholder: "50, \"gold\", etc.", defaultValue: "50" },
            { id: "successOutput", label: "Output when condition is true", type: "text", placeholder: "approved, pass, etc.", defaultValue: "approved" },
            { id: "failureOutput", label: "Output when condition is false", type: "text", placeholder: "rejected, fail, etc.", defaultValue: "rejected" },
        ],
        generate(v) {
            const name = v["workflowName"] || "Decision Maker";
            const field = sanitizeId(v["inputField"] || "value");
            const condition = v["condition"] || "is above";
            const rawThreshold = v["threshold"] || "50";
            const success = v["successOutput"] || "approved";
            const failure = v["failureOutput"] || "rejected";

            const threshold = isNumeric(rawThreshold) ? rawThreshold : `"${rawThreshold}"`;
            const inputValue = isNumeric(rawThreshold) ? rawThreshold : `"${rawThreshold}"`;

            const code = `# ${name}
# Generated from the Conditional Logic template.

config:
    name: "${name}"
    version: 1

workflow:
    trigger: when a request is received

    set ${field} to request.${field}
    log "Checking ${field}: {${field}}"

    step Evaluate:
        if ${field} ${condition} ${threshold}:
            set decision to "${success}"
            log "Condition met"
        otherwise:
            set decision to "${failure}"
            log "Condition not met"

    complete with decision decision and ${field} ${field}
`;
            const input = `{ "${field}": ${inputValue} }`;
            return { code, input };
        },
    },

    // 3. Loop & Aggregate
    {
        id: "loop-aggregate",
        name: "Loop & Aggregate",
        description: "Process a list of items and calculate running totals",
        iconColor: "#4ADE80",
        iconPath: "M1 3h4v4H1V3zm6 1h8v2H7V4zM1 9h4v4H1V9zm6 1h8v2H7v-2z",
        fields: [
            { id: "workflowName", label: "Workflow name", type: "text", placeholder: "My Loop Workflow", defaultValue: "List Processor" },
            { id: "collection", label: "Collection field", type: "text", placeholder: "orders, users, tasks, etc.", defaultValue: "items", helpText: "The list in the request to loop over" },
            { id: "itemName", label: "Item variable name", type: "text", placeholder: "order, user, task, etc.", defaultValue: "item", helpText: "Name for each element in the loop" },
            { id: "valueField", label: "Value field to aggregate", type: "text", placeholder: "price, score, amount, etc.", defaultValue: "amount", helpText: "The numeric field on each item to sum up" },
            { id: "outputName", label: "Output name", type: "text", placeholder: "total, sum, etc.", defaultValue: "total" },
        ],
        generate(v) {
            const name = v["workflowName"] || "List Processor";
            const collection = sanitizeId(v["collection"] || "items");
            const item = sanitizeId(v["itemName"] || "item");
            const valueField = sanitizeId(v["valueField"] || "amount");
            const output = sanitizeId(v["outputName"] || "total");

            const code = `# ${name}
# Generated from the Loop & Aggregate template.

config:
    name: "${name}"
    version: 1

workflow:
    trigger: when a request is received

    set ${collection} to request.${collection}
    set ${output} to 0
    set count to 0
    log "Processing ${collection}"

    for each ${item} in ${collection}:
        set ${output} to ${output} plus ${item}.${valueField}
        set count to count plus 1
        log "Processed: {${item}.${valueField}}"

    log "Finished: ${output} = {${output}}, count = {count}"

    complete with ${output} ${output} and count count
`;
            const input = `{ "${collection}": [{ "${valueField}": 10 }, { "${valueField}": 20 }, { "${valueField}": 30 }] }`;
            return { code, input };
        },
    },

    // 4. Notification Sender
    {
        id: "notification-sender",
        name: "Notification Sender",
        description: "Send a message via webhook with retry on failure",
        iconColor: "#A78BFA",
        iconPath: "M2 3a1 1 0 011-1h10a1 1 0 011 1v2.5L8 8.5 2 5.5V3zm0 4l6 3 6-3v6a1 1 0 01-1 1H3a1 1 0 01-1-1V7z",
        fields: [
            { id: "workflowName", label: "Workflow name", type: "text", placeholder: "My Notification Workflow", defaultValue: "Send Notification" },
            { id: "serviceName", label: "Service name", type: "text", placeholder: "Slack, Discord, etc.", defaultValue: "Slack" },
            { id: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://hooks.slack.com/...", defaultValue: "https://hooks.slack.com/services/placeholder" },
            { id: "messageField", label: "Message input field", type: "text", placeholder: "message, text, etc.", defaultValue: "message", helpText: "The field in the request that contains the message" },
            { id: "channel", label: "Channel or target", type: "text", placeholder: "#general, @user, etc.", defaultValue: "#general" },
        ],
        generate(v) {
            const name = v["workflowName"] || "Send Notification";
            const svc = v["serviceName"] || "Slack";
            const url = v["webhookUrl"] || "https://hooks.slack.com/services/placeholder";
            const msgField = sanitizeId(v["messageField"] || "message");
            const channel = v["channel"] || "#general";

            const code = `# ${name}
# Generated from the Notification Sender template.

config:
    name: "${name}"
    version: 1

services:
    ${svc} is a webhook at "${url}"

workflow:
    trigger: when a notification is requested

    set ${msgField} to request.${msgField}
    log "Preparing to send notification"

    step SendNotification:
        send notification using ${svc} with text ${msgField} and channel "${channel}"
            on failure:
                retry 2 times waiting 3 seconds
                if still failing:
                    log "Could not reach ${svc}"
                    reject with "Notification delivery failed"

    log "Notification sent successfully"
    complete with status "sent" and ${msgField} ${msgField}
`;
            const input = `{ "${msgField}": "Hello from Flow!" }`;
            return { code, input };
        },
    },

    // 5. AI Decision
    {
        id: "ai-decision",
        name: "AI Decision",
        description: "Ask an AI to analyze data and branch on its confidence",
        iconColor: "#F87171",
        iconPath: "M8 0a8 8 0 100 16A8 8 0 008 0zm1 11H7V9h2v2zm0-4H7V3h2v4z",
        fields: [
            { id: "workflowName", label: "Workflow name", type: "text", placeholder: "My AI Workflow", defaultValue: "AI Analysis" },
            { id: "serviceName", label: "AI service name", type: "text", placeholder: "Reviewer, Classifier, etc.", defaultValue: "Analyst" },
            { id: "model", label: "AI model", type: "select", placeholder: "", defaultValue: "anthropic/claude-sonnet-4-20250514", options: ["anthropic/claude-sonnet-4-20250514", "openai/gpt-4o"] },
            { id: "instruction", label: "What should the AI do?", type: "textarea", placeholder: "Analyze the data and provide a recommendation", defaultValue: "analyze the data and provide a recommendation" },
            { id: "inputField", label: "Input field for the AI", type: "text", placeholder: "data, text, etc.", defaultValue: "data", helpText: "The field in the request to send to the AI" },
        ],
        generate(v) {
            const name = v["workflowName"] || "AI Analysis";
            const svc = v["serviceName"] || "Analyst";
            const model = v["model"] || "anthropic/claude-sonnet-4-20250514";
            const instruction = v["instruction"] || "analyze the data and provide a recommendation";
            const inputField = sanitizeId(v["inputField"] || "data");

            const code = `# ${name}
# Generated from the AI Decision template.

config:
    name: "${name}"
    version: 1

services:
    ${svc} is an AI using "${model}"

workflow:
    trigger: when a request is received

    set ${inputField} to request.${inputField}
    log "Sending data to ${svc} for analysis"

    ask ${svc} to ${instruction}
        save the result as analysis
        save the confidence as confidence

    log "Analysis complete, confidence: {confidence}"

    step EvaluateResult:
        if confidence is above 0.7:
            set decision to "high confidence"
            log "AI is confident in its analysis"
        otherwise if confidence is above 0.4:
            set decision to "moderate confidence"
            log "Moderate confidence, review recommended"
        otherwise:
            set decision to "low confidence"
            log "Low confidence, manual review needed"

    complete with analysis analysis and confidence confidence and decision decision
`;
            const input = `{ "${inputField}": "Sample data for the AI to analyze" }`;
            return { code, input };
        },
    },
];

// --- SVG Icons ---

function cardIcon(color: string, path: string): string {
    return `<svg width="20" height="20" viewBox="0 0 16 16" fill="${escapeHtml(color)}"><path d="${escapeHtml(path)}"/></svg>`;
}

// --- Rendering ---

function renderCards(container: HTMLElement, onSelect: (template: Template) => void): void {
    const grid = document.createElement("div");
    grid.className = "template-grid";

    for (const tmpl of TEMPLATES) {
        const card = document.createElement("div");
        card.className = "template-card";
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.innerHTML = `
            <div class="template-card-icon" style="background: ${tmpl.iconColor}20; color: ${tmpl.iconColor}">
                ${cardIcon(tmpl.iconColor, tmpl.iconPath)}
            </div>
            <div class="template-card-name">${escapeHtml(tmpl.name)}</div>
            <div class="template-card-desc">${escapeHtml(tmpl.description)}</div>
        `;
        card.addEventListener("click", () => onSelect(tmpl));
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(tmpl);
            }
        });
        grid.appendChild(card);
    }

    container.innerHTML = "";
    container.appendChild(grid);
}

function renderForm(
    container: HTMLElement,
    template: Template,
    onBack: () => void,
    onGenerate: (result: GeneratedCode) => void,
): void {
    const form = document.createElement("div");
    form.className = "template-form";

    // Back button
    const back = document.createElement("button");
    back.className = "form-back";
    back.innerHTML = `&larr; Back to templates`;
    back.addEventListener("click", onBack);
    form.appendChild(back);

    // Template name
    const heading = document.createElement("div");
    heading.className = "form-template-name";
    heading.textContent = template.name;
    form.appendChild(heading);

    // Fields
    const inputs = new Map<string, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();

    for (const field of template.fields) {
        const group = document.createElement("div");
        group.className = "form-group";

        const label = document.createElement("label");
        label.className = "form-label";
        label.textContent = field.label;
        label.setAttribute("for", `tmpl-${field.id}`);
        group.appendChild(label);

        let input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

        if (field.type === "select" && field.options) {
            const select = document.createElement("select");
            select.className = "form-select";
            for (const opt of field.options) {
                const option = document.createElement("option");
                option.value = opt;
                option.textContent = opt;
                if (opt === field.defaultValue) option.selected = true;
                select.appendChild(option);
            }
            input = select;
        } else if (field.type === "textarea") {
            const textarea = document.createElement("textarea");
            textarea.className = "form-textarea";
            textarea.placeholder = field.placeholder;
            textarea.value = field.defaultValue;
            input = textarea;
        } else {
            const textInput = document.createElement("input");
            textInput.className = "form-input";
            textInput.type = "text";
            textInput.placeholder = field.placeholder;
            textInput.value = field.defaultValue;
            input = textInput;
        }

        input.id = `tmpl-${field.id}`;
        group.appendChild(input);
        inputs.set(field.id, input);

        if (field.helpText) {
            const help = document.createElement("div");
            help.className = "form-help";
            help.textContent = field.helpText;
            group.appendChild(help);
        }

        form.appendChild(group);
    }

    // Generate button
    const btn = document.createElement("button");
    btn.className = "btn-generate";
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5v11l9-5.5L3 1.5z" fill="currentColor"/></svg> Generate & Load`;
    btn.addEventListener("click", () => {
        const values: Record<string, string> = {};
        for (const [id, input] of inputs) {
            values[id] = input.value;
        }
        onGenerate(template.generate(values));
    });
    form.appendChild(btn);

    container.innerHTML = "";
    container.appendChild(form);

    // Focus first input
    const firstInput = inputs.values().next().value;
    if (firstInput) (firstInput as HTMLElement).focus();
}

// --- Public API ---

export interface TemplateBuilder {
    onGenerate: (cb: (code: string, input: string) => void) => void;
}

export function initTemplateBuilder(): TemplateBuilder {
    const btn = document.getElementById("btn-template")!;
    const modal = document.getElementById("template-modal")!;
    const closeBtn = document.getElementById("modal-close")!;
    const body = document.getElementById("modal-body")!;
    const title = modal.querySelector(".modal-title")!;

    let generateCallback: ((code: string, input: string) => void) | null = null;

    function showCards(): void {
        title.textContent = "New from Template";
        renderCards(body, (template) => {
            title.textContent = template.name;
            renderForm(body, template, showCards, (result) => {
                closeModal();
                if (generateCallback) generateCallback(result.code, result.input);
            });
        });
    }

    function openModal(): void {
        modal.hidden = false;
        showCards();
    }

    function closeModal(): void {
        modal.hidden = true;
    }

    // Open
    btn.addEventListener("click", openModal);

    // Close: button, backdrop, escape
    closeBtn.addEventListener("click", closeModal);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeModal();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !modal.hidden) closeModal();
    });

    return {
        onGenerate(cb) {
            generateCallback = cb;
        },
    };
}
