import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/index.js";
import { execute, text, num, record, MockDatabaseConnector, type ServiceConnector } from "../../src/runtime/index.js";
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

// ============================================================
// Transaction Fraud Detection
// ============================================================

describe("Integration — transaction-fraud.flow", () => {
    const source = readExample("transaction-fraud.flow");

    // Helper: build connectors with controllable AI confidence.
    // The mock AI returns confidence 0.85 by default, which makes
    // the combined score always >= 43 (review). Using 0.7 lets us
    // test all three decision outcomes (approve / review / block).
    function fraudConnectors(aiConfidence: number = 0.7): Map<string, ServiceConnector> {
        const mockService: ServiceConnector = {
            async call() {
                return {
                    value: record({
                        status: text("ok"),
                        transactions_last_hour: num(2),
                        transactions_last_day: num(10),
                    }),
                };
            },
        };
        const aiService: ServiceConnector = {
            async call(_verb: string, description: string) {
                return {
                    value: record({
                        result: text(`mock risk analysis for: ${description}`),
                        confidence: num(aiConfidence),
                    }),
                };
            },
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("TransactionDB", mockService);
        connectors.set("VelocityCheck", mockService);
        connectors.set("RiskScorer", aiService);
        connectors.set("FraudOps", mockService);
        connectors.set("AuditTrail", mockService);
        return connectors;
    }

    async function runFraud(
        input: Record<string, unknown>,
        aiConfidence: number = 0.7,
    ): Promise<ExecutionResult> {
        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        return await execute(program, source, {
            connectors: fraudConnectors(aiConfidence),
            input,
        });
    }

    it("passes flow check with zero errors", () => {
        checkFile(source, "transaction-fraud.flow");
    });

    it("approves low-risk transaction", async () => {
        // rule-score = 0 (low amount, card present, US, normal category)
        // ai-score = 70 (0.7 * 100), combined = (0 + 70) / 2 = 35 → approve
        const result = await runFraud({
            transaction: {
                id: "TXN-001",
                amount: 500,
                merchant: "Coffee Shop",
                merchant_category: "food",
                card_present: true,
                customer_id: "CUST-001",
                country: "US",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["decision"]).toEqual(text("approve"));
        }
    });

    it("flags medium-risk transaction for review", async () => {
        // rule-score = 40 (amount >5000: +20, CNP + amount >2000: +20)
        // ai-score = 70, combined = (40 + 70) / 2 = 55 → review
        const result = await runFraud({
            transaction: {
                id: "TXN-002",
                amount: 8500,
                merchant: "Online Store",
                merchant_category: "retail",
                card_present: false,
                customer_id: "CUST-002",
                country: "US",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["decision"]).toEqual(text("review"));
        }
    });

    it("blocks high-risk transaction", async () => {
        // rule-score = 105 (amount >10000: +40, gambling: +30, CNP: +20, cross-border: +15)
        // ai-score = 70, combined = (105 + 70) / 2 = 88 → block
        const result = await runFraud({
            transaction: {
                id: "TXN-003",
                amount: 15000,
                merchant: "Casino Online",
                merchant_category: "gambling",
                card_present: false,
                customer_id: "CUST-003",
                country: "NG",
            },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["decision"]).toEqual(text("block"));
        }
    });

    it("executes all 7 steps", async () => {
        const result = await runFraud({
            transaction: {
                id: "TXN-004",
                amount: 500,
                merchant: "Test Store",
                merchant_category: "retail",
                card_present: true,
                customer_id: "CUST-004",
                country: "US",
            },
        });
        const stepStarts = result.log.filter(e => e.action.includes("started"));
        const stepNames = stepStarts.map(e => e.step);
        expect(stepNames).toContain("ValidateTransaction");
        expect(stepNames).toContain("VelocityScreen");
        expect(stepNames).toContain("RuleBasedScreening");
        expect(stepNames).toContain("AIRiskAssessment");
        expect(stepNames).toContain("DecisionEngine");
        expect(stepNames).toContain("Escalation");
        expect(stepNames).toContain("RecordAudit");
    });

    it("logs fraud check started", async () => {
        const result = await runFraud({
            transaction: {
                id: "TXN-005",
                amount: 100,
                merchant: "Test",
                merchant_category: "food",
                card_present: true,
                customer_id: "CUST-005",
                country: "US",
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Fraud check started"))).toBe(true);
    });

    it("rejects missing transaction ID", async () => {
        // Reject happens in ValidateTransaction before any service calls,
        // so default mock connectors from runFile are fine.
        const result = await runFile(source, {
            transaction: { id: "" },
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("Missing transaction ID");
        }
    });

    it("logs combined risk score", async () => {
        const result = await runFraud({
            transaction: {
                id: "TXN-006",
                amount: 500,
                merchant: "Test",
                merchant_category: "food",
                card_present: true,
                customer_id: "CUST-006",
                country: "US",
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Combined risk score"))).toBe(true);
    });
});

// ============================================================
// Payment Reconciliation
// ============================================================

describe("Integration — payment-reconciliation.flow", () => {
    const source = readExample("payment-reconciliation.flow");

    function reconciliationConnectors(aiConfidence: number = 0.85): Map<string, ServiceConnector> {
        const mockAPI: ServiceConnector = {
            async call() {
                return {
                    value: record({
                        status: text("ok"),
                        date: text("2024-03-01"),
                        amount: num(5700),
                    }),
                };
            },
        };
        const aiService: ServiceConnector = {
            async call(_verb: string, description: string) {
                return {
                    value: record({
                        result: text(`mock analysis for: ${description}`),
                        confidence: num(aiConfidence),
                    }),
                };
            },
        };
        const mockWebhook: ServiceConnector = {
            async call() {
                return { value: record({ ok: text("true") }) };
            },
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("Ledger", mockAPI);
        connectors.set("Processor", mockAPI);
        connectors.set("Analyst", aiService);
        connectors.set("FinanceOps", mockWebhook);
        connectors.set("ReconciliationDB", mockAPI);
        return connectors;
    }

    async function runReconciliation(
        input: Record<string, unknown>,
        aiConfidence: number = 0.85,
    ): Promise<ExecutionResult> {
        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        return await execute(program, source, {
            connectors: reconciliationConnectors(aiConfidence),
            input,
        });
    }

    const balancedInput = {
        reconciliation: {
            batch_id: "BATCH-001",
            date: "2024-03-01",
            ledger_total: 5700,
            ledger_count: 2,
            settlements: [
                { id: "SET-001", amount: 2500, status: "cleared" },
                { id: "SET-002", amount: 3200, status: "cleared" },
            ],
        },
    };

    it("passes flow check with zero errors", () => {
        checkFile(source, "payment-reconciliation.flow");
    });

    it("reports balanced when totals match", async () => {
        const result = await runReconciliation(balancedInput);
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["mismatch"]).toEqual({ type: "boolean", value: false });
        }
    });

    it("detects count mismatch", async () => {
        const result = await runReconciliation({
            reconciliation: {
                batch_id: "BATCH-002",
                date: "2024-03-01",
                ledger_total: 5700,
                ledger_count: 5,
                settlements: [
                    { id: "SET-001", amount: 2500, status: "cleared" },
                    { id: "SET-002", amount: 3200, status: "cleared" },
                ],
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Count difference"))).toBe(true);
    });

    it("detects total mismatch", async () => {
        const result = await runReconciliation({
            reconciliation: {
                batch_id: "BATCH-003",
                date: "2024-03-01",
                ledger_total: 130000,
                ledger_count: 2,
                settlements: [
                    { id: "SET-001", amount: 62500, status: "cleared" },
                    { id: "SET-002", amount: 62500, status: "cleared" },
                ],
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Total difference"))).toBe(true);
    });

    it("executes all 6 steps", async () => {
        const result = await runReconciliation(balancedInput);
        const stepStarts = result.log.filter(e => e.action.includes("started"));
        const stepNames = stepStarts.map(e => e.step);
        expect(stepNames).toContain("ValidateRequest");
        expect(stepNames).toContain("FetchRecords");
        expect(stepNames).toContain("CalculateTotals");
        expect(stepNames).toContain("CompareResults");
        expect(stepNames).toContain("AnalyzeDiscrepancies");
        expect(stepNames).toContain("RecordResult");
    });

    it("logs reconciliation start", async () => {
        const result = await runReconciliation(balancedInput);
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Reconciliation started"))).toBe(true);
    });

    it("rejects missing batch ID", async () => {
        const result = await runReconciliation({
            reconciliation: {
                batch_id: "",
                date: "2024-03-01",
                ledger_total: 5700,
                ledger_count: 2,
                settlements: [{ id: "SET-001", amount: 5700, status: "cleared" }],
            },
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("Missing batch ID");
        }
    });
});

// ============================================================
// Chargeback Dispute Handler
// ============================================================

describe("Integration — chargeback-dispute.flow", () => {
    const source = readExample("chargeback-dispute.flow");

    function chargebackConnectors(
        aiResult: string = "Based on the evidence, I recommend we accept this dispute.",
        aiConfidence: number = 0.85,
    ): Map<string, ServiceConnector> {
        const mockAPI: ServiceConnector = {
            async call() {
                return {
                    value: record({
                        status: text("ok"),
                        date: text("2024-02-15"),
                        amount: num(249.99),
                        dispute_count: num(1),
                        account_age_months: num(24),
                        total_spend: num(5200),
                        tracking: text("1Z999AA10123456784"),
                        delivered: text("true"),
                    }),
                };
            },
        };
        const aiService: ServiceConnector = {
            async call() {
                return {
                    value: record({
                        result: text(aiResult),
                        confidence: num(aiConfidence),
                    }),
                };
            },
        };
        const mockWebhook: ServiceConnector = {
            async call() {
                return { value: record({ ok: text("true") }) };
            },
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("TransactionDB", mockAPI);
        connectors.set("ShippingTracker", mockAPI);
        connectors.set("CustomerDB", mockAPI);
        connectors.set("CaseBuilder", aiService);
        connectors.set("PaymentProcessor", mockAPI);
        connectors.set("DisputeOps", mockWebhook);
        return connectors;
    }

    async function runChargeback(
        input: Record<string, unknown>,
        aiResult?: string,
        aiConfidence?: number,
    ): Promise<ExecutionResult> {
        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        return await execute(program, source, {
            connectors: chargebackConnectors(aiResult, aiConfidence),
            input,
        });
    }

    const validInput = {
        chargeback: {
            dispute_id: "DSP-4892",
            transaction_id: "TXN-7210",
            amount: 249.99,
            reason_code: "product_not_received",
            customer_id: "CUST-1138",
            filed_date: "2024-02-28",
        },
    };

    it("passes flow check with zero errors", () => {
        checkFile(source, "chargeback-dispute.flow");
    });

    it("contests when AI recommends contest", async () => {
        const result = await runChargeback(
            validInput,
            "Based on strong delivery evidence, I recommend we contest this dispute.",
            0.85,
        );
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["action"]).toEqual(text("contest"));
        }
    });

    it("accepts with default mock (no contest keyword)", async () => {
        const result = await runChargeback(
            validInput,
            "Based on the evidence, I recommend we accept this dispute.",
            0.85,
        );
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["action"]).toEqual(text("accept"));
        }
    });

    it("escalates on low confidence", async () => {
        const result = await runChargeback(
            validInput,
            "Unclear evidence, could go either way.",
            0.4,
        );
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["action"]).toEqual(text("escalate"));
        }
    });

    it("gathers shipping evidence for product_not_received", async () => {
        const result = await runChargeback(validInput);
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("Shipping evidence gathered"))).toBe(true);
    });

    it("skips shipping for other reason codes", async () => {
        const result = await runChargeback({
            chargeback: {
                dispute_id: "DSP-5001",
                transaction_id: "TXN-8000",
                amount: 150,
                reason_code: "fraudulent",
                customer_id: "CUST-2000",
                filed_date: "2024-03-01",
            },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("not required"))).toBe(true);
    });

    it("rejects missing dispute ID", async () => {
        const result = await runChargeback({
            chargeback: {
                dispute_id: "",
                transaction_id: "TXN-7210",
                amount: 249.99,
                reason_code: "product_not_received",
                customer_id: "CUST-1138",
                filed_date: "2024-02-28",
            },
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("Missing dispute ID");
        }
    });

    it("executes all 7 steps", async () => {
        const result = await runChargeback(validInput);
        const stepStarts = result.log.filter(e => e.action.includes("started"));
        const stepNames = stepStarts.map(e => e.step);
        expect(stepNames).toContain("ValidateDispute");
        expect(stepNames).toContain("GatherTransactionEvidence");
        expect(stepNames).toContain("GatherShippingEvidence");
        expect(stepNames).toContain("GatherCustomerHistory");
        expect(stepNames).toContain("BuildResponse");
        expect(stepNames).toContain("SubmitResponse");
        expect(stepNames).toContain("NotifyTeam");
    });
});

// ============================================================
// Inventory Lookup (database connector)
// ============================================================

describe("Integration — inventory-lookup.flow", () => {
    const source = readExample("inventory-lookup.flow");

    it("passes flow check with zero errors", () => {
        checkFile(source, "inventory-lookup.flow");
    });

    it("completes with in-stock status when stock is sufficient", async () => {
        const mockDB: ServiceConnector = {
            async call() {
                return {
                    value: record({
                        id: num(1),
                        name: text("Widget"),
                        stock: num(100),
                    }),
                };
            },
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("DB", mockDB);

        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        const result = await execute(program, source, {
            connectors,
            input: { request: { "product-id": 1 } },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("in-stock"));
        }
    });

    it("completes with low-stock status when stock is below 10", async () => {
        const mockDB: ServiceConnector = {
            async call() {
                return {
                    value: record({
                        id: num(2),
                        name: text("Rare Part"),
                        stock: num(3),
                    }),
                };
            },
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("DB", mockDB);

        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        const result = await execute(program, source, {
            connectors,
            input: { request: { "product-id": 2 } },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("low-stock"));
        }
    });

    it("rejects when product is not found", async () => {
        const mockDB: ServiceConnector = {
            async call() {
                return { value: { type: "empty" as const } };
            },
        };
        const connectors = new Map<string, ServiceConnector>();
        connectors.set("DB", mockDB);

        const tokens = tokenize(source);
        const { program } = parse(tokens, source);
        const result = await execute(program, source, {
            connectors,
            input: { request: { "product-id": 999 } },
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("Product not found");
        }
    });
});
