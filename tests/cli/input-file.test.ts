import { describe, it, expect } from "vitest";
import { join } from "path";
import { writeFileSync, unlinkSync } from "fs";
import * as XLSX from "xlsx";
import { parseInputFile } from "../../src/cli/input-file.js";

const FIXTURES = join(import.meta.dirname, "fixtures");

// ── JSON ─────────────────────────────────────────────────

describe("parseInputFile — JSON", () => {
    it("reads a JSON file as input", () => {
        const result = parseInputFile(join(FIXTURES, "single-user.json"));
        expect(result).toEqual({
            name: "Alice",
            email: "alice@example.com",
            age: 30,
        });
    });

    it("throws on invalid JSON", () => {
        const bad = join(FIXTURES, "bad.json");
        writeFileSync(bad, "{ not json }", "utf-8");
        try {
            expect(() => parseInputFile(bad)).toThrow();
        } finally {
            unlinkSync(bad);
        }
    });

    it("throws on missing file", () => {
        expect(() => parseInputFile(join(FIXTURES, "nope.json"))).toThrow();
    });
});

// ── CSV ──────────────────────────────────────────────────

describe("parseInputFile — CSV", () => {
    it("reads a single-row CSV as a flat record", () => {
        const result = parseInputFile(join(FIXTURES, "single-row.csv"));
        expect(result).toEqual({
            name: "Alice",
            email: "alice@example.com",
            age: 30,
        });
    });

    it("reads a multi-row CSV as { rows, count }", () => {
        const result = parseInputFile(join(FIXTURES, "multi-row.csv"));
        expect(result).toEqual({
            rows: [
                { name: "Alice", email: "alice@example.com", age: 30 },
                { name: "Bob", email: "bob@example.com", age: 25 },
                { name: "Carol", email: "carol@example.com", age: 35 },
            ],
            count: 3,
        });
    });

    it("throws on CSV with headers only (no data rows)", () => {
        expect(() => parseInputFile(join(FIXTURES, "empty.csv"))).toThrow(
            "no data rows"
        );
    });
});

// ── XLSX ─────────────────────────────────────────────────

describe("parseInputFile — XLSX", () => {
    function createXlsx(
        fileName: string,
        rows: Record<string, unknown>[]
    ): string {
        const filePath = join(FIXTURES, fileName);
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, filePath);
        return filePath;
    }

    it("reads a single-row XLSX as a flat record", () => {
        const path = createXlsx("single.xlsx", [
            { name: "Bob", role: "admin", active: true },
        ]);
        try {
            const result = parseInputFile(path);
            expect(result).toEqual({
                name: "Bob",
                role: "admin",
                active: true,
            });
        } finally {
            unlinkSync(path);
        }
    });

    it("reads a multi-row XLSX as { rows, count }", () => {
        const path = createXlsx("multi.xlsx", [
            { product: "Widget", price: 9.99, qty: 5 },
            { product: "Gadget", price: 19.99, qty: 2 },
        ]);
        try {
            const result = parseInputFile(path);
            expect(result).toEqual({
                rows: [
                    { product: "Widget", price: 9.99, qty: 5 },
                    { product: "Gadget", price: 19.99, qty: 2 },
                ],
                count: 2,
            });
        } finally {
            unlinkSync(path);
        }
    });

    it("reads an XLS file the same way", () => {
        const path = createXlsx("test.xls", [
            { city: "Lagos", country: "Nigeria" },
        ]);
        try {
            const result = parseInputFile(path);
            expect(result).toEqual({
                city: "Lagos",
                country: "Nigeria",
            });
        } finally {
            unlinkSync(path);
        }
    });
});

// ── Unsupported formats ──────────────────────────────────

describe("parseInputFile — unsupported", () => {
    it("throws on unsupported file extension", () => {
        expect(() => parseInputFile("data.xml")).toThrow(
            'Unsupported file type ".xml"'
        );
    });

    it("throws on .txt files", () => {
        expect(() => parseInputFile("input.txt")).toThrow(
            'Unsupported file type ".txt"'
        );
    });
});
