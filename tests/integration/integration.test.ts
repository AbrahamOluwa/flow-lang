import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/index.js";
import { execute, text, num } from "../../src/runtime/index.js";
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

function runFile(source: string, input?: Record<string, unknown>): ExecutionResult {
    const tokens = tokenize(source);
    const { program } = parse(tokens, source);
    return execute(program, source, { input });
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

    it("completes successfully with valid email input", () => {
        const result = runFile(source, {
            signup: { email: "alice@example.com" },
        });
        expect(result.result.status).toBe("completed");
        if (result.result.status === "completed") {
            expect(result.result.outputs["status"]).toEqual(text("verified"));
            expect(result.result.outputs["email"]).toEqual(text("alice@example.com"));
        }
    });

    it("rejects when email is empty", () => {
        const result = runFile(source, {
            signup: { email: "" },
        });
        expect(result.result.status).toBe("rejected");
        if (result.result.status === "rejected") {
            expect(result.result.message).toContain("could not be verified");
        }
    });

    it("logs the verification step", () => {
        const result = runFile(source, {
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

    it("processes an order successfully", () => {
        const result = runFile(source, {
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

    it("counts items correctly in the loop", () => {
        const result = runFile(source, {
            order: {
                id: "ORD-001",
                items: ["a", "b", "c", "d"],
                subtotal: 40,
            },
        });
        const msgs = logMessages(result);
        expect(msgs).toContain("Checked 4 items");
    });

    it("logs the order ID", () => {
        const result = runFile(source, {
            order: { id: "ORD-555", items: ["x"], subtotal: 10 },
        });
        const msgs = logMessages(result);
        expect(msgs.some(m => m.includes("ORD-555"))).toBe(true);
    });

    it("executes all four steps", () => {
        const result = runFile(source, {
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

    it("approves a standard loan application", () => {
        const result = runFile(source, {
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

    it("calculates correct rate for amount above 50000", () => {
        const result = runFile(source, {
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

    it("calculates correct rate for amount between 20000 and 50000", () => {
        const result = runFile(source, {
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

    it("calculates monthly payment", () => {
        const result = runFile(source, {
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

    it("executes all six steps", () => {
        const result = runFile(source, {
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

    it("logs identity verification and credit report", () => {
        const result = runFile(source, {
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

    it("logs risk assessment confidence", () => {
        const result = runFile(source, {
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
