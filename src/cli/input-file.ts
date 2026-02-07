import { readFileSync } from "fs";
import { extname } from "path";
import XLSX from "xlsx";

const SUPPORTED_EXTENSIONS = new Set([".json", ".csv", ".xlsx", ".xls"]);

export function parseInputFile(filePath: string): Record<string, unknown> {
    const ext = extname(filePath).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
        throw new Error(
            `Unsupported file type "${ext}". Supported types: .json, .csv, .xlsx, .xls`
        );
    }

    if (ext === ".json") {
        const raw = readFileSync(filePath, "utf-8");
        return JSON.parse(raw) as Record<string, unknown>;
    }

    // CSV, XLSX, XLS — use SheetJS
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new Error("The file has no sheets.");
    }

    const sheet = workbook.Sheets[sheetName]!;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (rows.length === 0) {
        throw new Error("The file has no data rows.");
    }

    // Single row → flat record; multiple rows → { rows: [...], count: N }
    if (rows.length === 1) {
        return rows[0]!;
    }
    return { rows, count: rows.length };
}
