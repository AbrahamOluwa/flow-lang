import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/index.js";
import { execute, text, num, record, type ServiceConnector } from "../../src/runtime/index.js";
import type { ExecutionResult, FlowValue } from "../../src/types/index.js";

// ============================================================
// Helpers
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = resolve(__dirname, "../../examples");

function readExample(name: string): string {
    return readFileSync(resolve(examplesDir, name), "utf-8");
}

function checkFile(source: string, fileName: string): void {
    const tokens = tokenize(source, fileName);
    const { program, errors: parseErrors } = parse(tokens, source, fileName);
    const analysisErrors = analyze(program, source, fileName);
    const allErrors = [...parseErrors, ...analysisErrors];
    expect(allErrors, `Errors in ${fileName}: ${allErrors.map(e => e.message).join("; ")}`).toHaveLength(0);
}

async function runFile(source: string, input?: Record<string, unknown>): Promise<ExecutionResult> {
    const tokens = tokenize(source);
    const { program } = parse(tokens, source);
    return await execute(program, source, { input });
}

function logMessages(result: ExecutionResult): string[] {
    return result.log
        .filter(e => e.action === "log" && e.details["message"])
        .map(e => e.details["message"] as string);
}

// ============================================================
// Email Verification
// ============================================================

describe("Integration — email-verification.flow", () => {
    const source = readExample("email-verification.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "email-verification.flow");
    });

    it("completes successfully with valid email input", async () => {
        const result = await runFile(source, {
            signup: { email: "alice@example.com" },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("verified"));
            expect(result.result.outputs["email"]).toEqual(text("alice@example.com"));
        }
    });

    it("rejects when email is empty", async () => {
        const result = await runFile(source, {
            signup: { email: "" },
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("could not be verified");
        }
    });

    it("logs the verification step", async () => {
        const result = await runFile(source, {
            signup: { email: "test@test.com" },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Verifying email"))).toBe(true);
    });
});

// ============================================================
// Order Processing
// ============================================================

describe("Integration — order-processing.flow", () => {
    const source = readExample("order-processing.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "order-processing.flow");
    });

    it("processes an order successfully", async () => {
        const result = await runFile(source, {
            order: {
                id: "ORD-789",
                items: ["widget", "gadget", "doohickey"],
                subtotal: 150.00,
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("processed"));
            expect(result.result.outputs["order-id"]).toEqual(text("ORD-789"));
            // total = 150 + (150 * 0.08) = 162
            expect(result.result.outputs["total"]).toEqual(num(162));
        }
    });

    it("counts items correctly in the loop", async () => {
        const result = await runFile(source, {
            order: {
                id: "ORD-001",
                items: ["a", "b", "c", "d"],
                subtotal: 40,
            },
        });
        const msgs = logMessages(result);
        expect(msgs).toContain("Checked 4 items");
    });

    it("logs the order ID", async () => {
        const result = await runFile(source, {
            order: { id: "ORD-555", items: ["x"], subtotal: 10 },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("ORD-555"))).toBe(true);
    });

    it("executes all four steps", async () => {
        const result = await runFile(source, {
            order: { id: "ORD-1", items: ["item"], subtotal: 100 },
        });
        const stepStarts = result.log.filter(e => e.action.includes("started"));
        const stepNames = stepStarts.map(e => e.step);
        expect(stepNames).toContain("CheckInventory");
        expect(stepNames).toContain("CalculateTotal");
        expect(stepNames).toContain("ChargePayment");
        expect(stepNames).toContain("SendConfirmation");
    });
});

// ============================================================
// Loan Application
// ============================================================

describe("Integration — loan-application.flow", () => {
    const source = readExample("loan-application.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "loan-application.flow");
    });

    it("approves a standard loan application", async () => {
        const result = await runFile(source, {
            application: {
                name: "Jane Doe",
                email: "jane@example.com",
                amount: 25000,
                id: "APP-100",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("approved"));
            expect(result.result.outputs["applicant"]).toEqual(text("Jane Doe"));
            expect(result.result.outputs["amount"]).toEqual(num(25000));
        }
    });

    it("calculates correct rate for amount above 50000", async () => {
        const result = await runFile(source, {
            application: {
                name: "John Smith",
                email: "john@example.com",
                amount: 75000,
                id: "APP-200",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            // base-rate 5.5 + risk-adjustment 1.5 = 7.0
            expect(result.result.outputs["rate"]).toEqual(num(7));
        }
    });

    it("calculates correct rate for amount between 20000 and 50000", async () => {
        const result = await runFile(source, {
            application: {
                name: "Alice",
                email: "alice@example.com",
                amount: 35000,
                id: "APP-300",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            // base-rate 5.5 + risk-adjustment 0.75 = 6.25
            expect(result.result.outputs["rate"]).toEqual(num(6.25));
        }
    });

    it("calculates monthly payment", async () => {
        const result = await runFile(source, {
            application: {
                name: "Bob",
                email: "bob@example.com",
                amount: 12000,
                id: "APP-400",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            // amount 12000 <= 20000, so risk_adj = 0, rate = 5.5
            // monthly = 12000 * 5.5 / 1200 = 55.00
            expect(result.result.outputs["monthly-payment"]).toEqual(num(55));
        }
    });

    it("executes all six steps", async () => {
        const result = await runFile(source, {
            application: {
                name: "Test",
                email: "test@test.com",
                amount: 10000,
                id: "APP-500",
            },
        });
        const stepStarts = result.log.filter(e => e.action.includes("started"));
        const stepNames = stepStarts.map(e => e.step);
        expect(stepNames).toContain("VerifyIdentity");
        expect(stepNames).toContain("CreditCheck");
        expect(stepNames).toContain("RiskAssessment");
        expect(stepNames).toContain("FraudScreening");
        expect(stepNames).toContain("CalculateTerms");
        expect(stepNames).toContain("RecordDecision");
    });

    it("logs identity verification and credit report", async () => {
        const result = await runFile(source, {
            application: {
                name: "Tester",
                email: "t@t.com",
                amount: 5000,
                id: "APP-600",
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Identity verified"))).toBe(true);
        expect(msgs.some(m => m.includes("Credit report"))).toBe(true);
    });

    it("logs risk assessment confidence", async () => {
        const result = await runFile(source, {
            application: {
                name: "Tester",
                email: "t@t.com",
                amount: 5000,
                id: "APP-700",
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("confidence"))).toBe(true);
    });
});

// ============================================================
// Service Headers (end-to-end)
// ============================================================

describe("Integration — service headers", () => {
    it("end-to-end: headers with env interpolation are passed to connector", async () => {
        const source = [
            "config:",
            '    name: "API with Auth"',
            "    version: 1",
            "",
            "services:",
            '    GitHub is an API at "https://api.github.com"',
            "        with headers:",
            '            Authorization: "token {env.GITHUB_TOKEN}"',
            '            Accept: "application/vnd.github.v3+json"',
            "",
            "workflow:",
            "    trigger: when a request is received",
            "    get repos using GitHub",
            "        save the result as repos",
            '    complete with status "ok"',
        ].join("\n");

        // Verify it passes check with zero errors
        const tokens = tokenize(source);
        const { program, errors: parseErrors } = parse(tokens, source);
        const analysisErrors = analyze(program, source);
        expect([...parseErrors, ...analysisErrors]).toHaveLength(0);

        // Verify headers reach the connector at runtime
        const receivedHeaders: Record<string, string>[] = [];
        const spyConnector: ServiceConnector = {
            async call(_verb, _desc, _params, _path, headers) {
                receivedHeaders.push(headers ?? {});
                return { value: record({ repos: text("mock-repo-list") }) };
            }
        };

        const connectors = new Map<string, ServiceConnector>();
        connectors.set("GitHub", spyConnector);

        const result = await execute(program, source, {
            connectors,
            envVars: { GITHUB_TOKEN: "ghp_realtoken123" },
        });

        expect(result.result.status).toBe("completed");
        expect(receivedHeaders).toHaveLength(1);
        expect(receivedHeaders[0]!["Authorization"]).toBe("token ghp_realtoken123");
        expect(receivedHeaders[0]!["Accept"]).toBe("application/vnd.github.v3+json");
    });
});

// ============================================================
// Response access — end-to-end
// ============================================================

describe("Integration — response access", () => {
    it("service call with save status and headers, status check in condition", () => {
        const source = [
            "services:",
            '    API is an API at "https://example.com"',
            "",
            "workflow:",
            '    create item using API with name "test"',
            "        save the result as data",
            "        save the status as status-code",
            "        save the response headers as resp-headers",
            "    if status-code is 201:",
            '        log "created"',
            "    otherwise:",
            '        log "other"',
            '    complete with result data.name and status status-code',
        ].join("\n");

        // Parse + analyze
        const tokens = tokenize(source);
        const { program, errors: parseErrors } = parse(tokens, source);
        const analysisErrors = analyze(program, source);
        expect([...parseErrors, ...analysisErrors]).toHaveLength(0);

        // Execute with spy connector
        const spyConnector: ServiceConnector = {
            async call() {
                return {
                    value: record({ name: text("widget") }),
                    status: 201,
                    headers: { "location": "/items/42" },
                };
            }
        };

        const connectors = new Map<string, ServiceConnector>();
        connectors.set("API", spyConnector);

        return execute(program, source, { connectors }).then(result => {
            expect(result.result.status).toBe("completed");
            if (result.result.status === "completed") {
                expect(result.result.outputs["result"]).toEqual(text("widget"));
                expect(result.result.outputs["status"]).toEqual(num(201));
            }
            // Check that "created" was logged (status 201 matched the condition)
            const logs = result.log.filter(e => e.action === "log");
            expect(logs).toHaveLength(1);
            expect(logs[0]!.details["message"]).toBe("created");
        });
    });
});

// ============================================================
// Stripe Checkout
// ============================================================

describe("Integration — stripe-checkout.flow", () => {
    const source = readExample("stripe-checkout.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "stripe-checkout.flow");
    });

    it("completes successfully with spy connectors", async () => {
        const spyAPI: ServiceConnector = {
            async call() {
                return { value: record({ id: text("ch_123") }), status: 200 };
            }
        };
        const spyWebhook: ServiceConnector = {
            async call() {
                return { value: record({ ok: text("true") }) };
            }
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("Stripe", spyAPI);
        connectors.set("SlackNotifier", spyWebhook);

        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        const result = await execute(program, source, {
            connectors,
            input: {
                customer_email: "ada@example.com",
                amount: 5000,
                currency: "usd",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("paid"));
            expect(result.result.outputs["email"]).toEqual(text("ada@example.com"));
        }
    });
});

// ============================================================
// Slack Notification
// ============================================================

describe("Integration — slack-notification.flow", () => {
    const source = readExample("slack-notification.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "slack-notification.flow");
    });

    it("completes with success notification", async () => {
        const result = await runFile(source, {
            event: "deploy",
            service: "api-v2",
            version: "1.4.0",
            status: "success",
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("notified"));
        }
        const logs = logMessages(result);
        expect(logs).toContain("Notification sent: Deployed api-v2 v1.4.0 successfully");
    });
});

// ============================================================
// SendGrid Email
// ============================================================

describe("Integration — sendgrid-email.flow", () => {
    const source = readExample("sendgrid-email.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "sendgrid-email.flow");
    });

    it("completes successfully with valid input", async () => {
        const result = await runFile(source, {
            to: "ada@example.com",
            subject: "Welcome!",
            body: "Thanks for signing up.",
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("sent"));
            expect(result.result.outputs["recipient"]).toEqual(text("ada@example.com"));
            expect(result.result.outputs["subject"]).toEqual(text("Welcome!"));
        }
    });

    it("rejects when recipient is empty", async () => {
        const result = await runFile(source, {
            to: "",
            subject: "Welcome!",
            body: "Thanks for signing up.",
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("Recipient");
        }
    });
});
