import type {
    Program, Statement, Expression,
    ServiceCall, AskStatement, SetStatement, IfStatement,
    ForEachStatement, LogStatement, CompleteStatement, RejectStatement,
    StepBlock, ErrorHandler, Parameter,
    SourceLocation, ServiceDeclaration,
    FlowValue, FlowText, FlowNumber, FlowBoolean, FlowList, FlowRecord, FlowEmpty,
    FlowError, LogEntry, ExecutionResult, WorkflowResult,
} from "../types/index.js";
import { createError } from "../errors/index.js";

// ============================================================
// FlowValue constructors
// ============================================================

export function text(value: string): FlowText {
    return { type: "text", value };
}

export function num(value: number): FlowNumber {
    return { type: "number", value };
}

export function bool(value: boolean): FlowBoolean {
    return { type: "boolean", value };
}

export function list(items: FlowValue[]): FlowList {
    return { type: "list", value: items };
}

export function record(entries: Record<string, FlowValue>): FlowRecord {
    const map = new Map<string, FlowValue>();
    for (const [k, v] of Object.entries(entries)) {
        map.set(k, v);
    }
    return { type: "record", value: map };
}

export const EMPTY: FlowEmpty = { type: "empty" };

// ============================================================
// FlowValue helpers
// ============================================================

export function toDisplay(value: FlowValue): string {
    switch (value.type) {
        case "text": return value.value;
        case "number": return String(value.value);
        case "boolean": return value.value ? "true" : "false";
        case "list": return "[" + value.value.map(toDisplay).join(", ") + "]";
        case "record": {
            const entries: string[] = [];
            for (const [k, v] of value.value) {
                entries.push(`${k}: ${toDisplay(v)}`);
            }
            return "{ " + entries.join(", ") + " }";
        }
        case "empty": return "(empty)";
    }
}

export function isTruthy(value: FlowValue): boolean {
    switch (value.type) {
        case "text": return value.value.length > 0;
        case "number": return value.value !== 0;
        case "boolean": return value.value;
        case "list": return value.value.length > 0;
        case "record": return value.value.size > 0;
        case "empty": return false;
    }
}

export function flowValuesEqual(a: FlowValue, b: FlowValue): boolean {
    if (a.type !== b.type) return false;
    switch (a.type) {
        case "text": return a.value === (b as FlowText).value;
        case "number": return a.value === (b as FlowNumber).value;
        case "boolean": return a.value === (b as FlowBoolean).value;
        case "empty": return true;
        case "list": {
            const bList = b as FlowList;
            if (a.value.length !== bList.value.length) return false;
            return a.value.every((item, i) => flowValuesEqual(item, bList.value[i]!));
        }
        case "record": {
            const bRec = b as FlowRecord;
            if (a.value.size !== bRec.value.size) return false;
            for (const [k, v] of a.value) {
                const bVal = bRec.value.get(k);
                if (!bVal || !flowValuesEqual(v, bVal)) return false;
            }
            return true;
        }
    }
}

function asNumber(value: FlowValue, loc: SourceLocation, ctx: ExecutionContext): number {
    if (value.type === "number") return value.value;
    throw new RuntimeError(
        `I expected a number here, but got ${value.type} (${toDisplay(value)}).`,
        loc, ctx.source, ctx.fileName
    );
}

// ============================================================
// JSON <-> FlowValue conversion
// ============================================================

export function jsonToFlowValue(data: unknown): FlowValue {
    if (data === null || data === undefined) return EMPTY;
    if (typeof data === "string") return text(data);
    if (typeof data === "number") return num(data);
    if (typeof data === "boolean") return bool(data);
    if (Array.isArray(data)) return list(data.map(jsonToFlowValue));
    if (typeof data === "object") {
        const map = new Map<string, FlowValue>();
        for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
            map.set(k, jsonToFlowValue(v));
        }
        return { type: "record", value: map };
    }
    return EMPTY;
}

export function flowValueToJson(value: FlowValue): unknown {
    switch (value.type) {
        case "text": return value.value;
        case "number": return value.value;
        case "boolean": return value.value;
        case "list": return value.value.map(flowValueToJson);
        case "record": {
            const obj: Record<string, unknown> = {};
            for (const [k, v] of value.value) {
                obj[k] = flowValueToJson(v);
            }
            return obj;
        }
        case "empty": return null;
    }
}

// ============================================================
// Runtime Error
// ============================================================

export class RuntimeError extends Error {
    public readonly flowError: FlowError;

    constructor(message: string, loc: SourceLocation, source: string, fileName: string) {
        super(message);
        this.name = "RuntimeError";
        this.flowError = createError(fileName, loc.line, loc.column, message, source);
    }
}

// ============================================================
// Environment (scope/variable store)
// ============================================================

export class Environment {
    private variables: Map<string, FlowValue> = new Map();
    private parent: Environment | null;

    constructor(parent: Environment | null = null) {
        this.parent = parent;
    }

    get(name: string): FlowValue | undefined {
        const val = this.variables.get(name);
        if (val !== undefined) return val;
        if (this.parent) return this.parent.get(name);
        return undefined;
    }

    set(name: string, value: FlowValue): void {
        // If the variable already exists in a parent scope, update it there
        // (so `set x to ...` inside a loop updates the outer x, not a new local x)
        let current: Environment | null = this.parent;
        while (current) {
            if (current.variables.has(name)) {
                current.variables.set(name, value);
                return;
            }
            current = current.parent;
        }
        // Otherwise define it in the current scope
        this.variables.set(name, value);
    }

    createChild(): Environment {
        return new Environment(this);
    }
}

// ============================================================
// Service Connectors
// ============================================================

export interface ServiceResponse {
    value: FlowValue;
    status?: number;
    headers?: Record<string, string>;
}

export interface ServiceConnector {
    call(verb: string, description: string, params: Map<string, FlowValue>, path?: string, headers?: Record<string, string>): Promise<ServiceResponse>;
}

export interface MockConnectorOptions {
    failCount?: number;
}

export class MockAPIConnector implements ServiceConnector {
    private callCount = 0;
    private failCount: number;

    constructor(options?: MockConnectorOptions) {
        this.failCount = options?.failCount ?? 0;
    }

    async call(verb: string, description: string, _params: Map<string, FlowValue>): Promise<ServiceResponse> {
        this.callCount++;
        if (this.callCount <= this.failCount) {
            throw new Error(`Service call failed: ${verb} ${description} (mock failure)`);
        }
        return {
            value: record({
                status: text("ok"),
                data: text(`mock response for: ${verb} ${description}`),
            }),
        };
    }
}

export class MockAIConnector implements ServiceConnector {
    private callCount = 0;
    private failCount: number;

    constructor(options?: MockConnectorOptions) {
        this.failCount = options?.failCount ?? 0;
    }

    async call(_verb: string, description: string, _params: Map<string, FlowValue>): Promise<ServiceResponse> {
        this.callCount++;
        if (this.callCount <= this.failCount) {
            throw new Error(`AI service failed: ${description} (mock failure)`);
        }
        return {
            value: record({
                result: text(`mock AI response for: ${description}`),
                confidence: num(0.85),
            }),
        };
    }
}

export class MockPluginConnector implements ServiceConnector {
    private callCount = 0;
    private failCount: number;

    constructor(options?: MockConnectorOptions) {
        this.failCount = options?.failCount ?? 0;
    }

    async call(verb: string, description: string, _params: Map<string, FlowValue>): Promise<ServiceResponse> {
        this.callCount++;
        if (this.callCount <= this.failCount) {
            throw new Error(`Plugin failed: ${verb} ${description} (mock failure)`);
        }
        return {
            value: record({
                status: text("ok"),
                data: text(`mock plugin response for: ${verb} ${description}`),
            }),
        };
    }
}

export class MockWebhookConnector implements ServiceConnector {
    private callCount = 0;
    private failCount: number;

    constructor(options?: MockConnectorOptions) {
        this.failCount = options?.failCount ?? 0;
    }

    async call(verb: string, description: string, _params: Map<string, FlowValue>): Promise<ServiceResponse> {
        this.callCount++;
        if (this.callCount <= this.failCount) {
            throw new Error(`Webhook failed: ${verb} ${description} (mock failure)`);
        }
        return {
            value: record({
                status: text("ok"),
            }),
        };
    }
}

// Database verb categories
const DB_SELECT_SINGLE_VERBS = new Set(["get", "fetch", "find", "check"]);
const DB_SELECT_MULTI_VERBS = new Set(["list", "search", "query"]);
const DB_COUNT_VERBS = new Set(["count"]);
const DB_INSERT_VERBS = new Set(["insert", "create", "add", "record", "save", "store"]);
const DB_UPDATE_VERBS = new Set(["update", "modify", "change"]);
const DB_DELETE_VERBS = new Set(["delete", "remove", "clear"]);

export class MockDatabaseConnector implements ServiceConnector {
    private callCount = 0;
    private failCount: number;

    constructor(options?: MockConnectorOptions) {
        this.failCount = options?.failCount ?? 0;
    }

    async call(verb: string, description: string, _params: Map<string, FlowValue>): Promise<ServiceResponse> {
        this.callCount++;
        if (this.callCount <= this.failCount) {
            throw new Error(`Database failed: ${verb} ${description} (mock failure)`);
        }
        const lower = verb.toLowerCase();
        if (DB_SELECT_SINGLE_VERBS.has(lower)) {
            return { value: record({ id: num(1), name: text("mock record") }) };
        }
        if (DB_SELECT_MULTI_VERBS.has(lower)) {
            return {
                value: list([
                    record({ id: num(1), name: text("record 1") }),
                    record({ id: num(2), name: text("record 2") }),
                ]),
            };
        }
        if (DB_COUNT_VERBS.has(lower)) {
            return { value: num(42) };
        }
        if (DB_INSERT_VERBS.has(lower)) {
            return { value: record({ id: num(1) }) };
        }
        if (DB_UPDATE_VERBS.has(lower) || DB_DELETE_VERBS.has(lower)) {
            return { value: record({ changes: num(1) }) };
        }
        return { value: record({ status: text("ok") }) };
    }
}

export function createMockConnector(serviceType: string, options?: MockConnectorOptions): ServiceConnector {
    switch (serviceType) {
        case "api": return new MockAPIConnector(options);
        case "ai": return new MockAIConnector(options);
        case "plugin": return new MockPluginConnector(options);
        case "webhook": return new MockWebhookConnector(options);
        case "database": return new MockDatabaseConnector(options);
        default: return new MockAPIConnector(options);
    }
}

// ============================================================
// Real Connectors
// ============================================================

// Verb-to-HTTP-method mapping
const GET_VERBS = new Set(["get", "fetch", "retrieve", "check", "pull", "list", "find", "search"]);
const POST_VERBS = new Set(["create", "send", "submit", "add", "post", "charge", "notify", "record", "verify"]);
const PUT_VERBS = new Set(["update", "modify", "change", "edit"]);
const DELETE_VERBS = new Set(["delete", "remove", "cancel"]);

export function inferHTTPMethod(verb: string): string {
    const lower = verb.toLowerCase();
    if (GET_VERBS.has(lower)) return "GET";
    if (POST_VERBS.has(lower)) return "POST";
    if (PUT_VERBS.has(lower)) return "PUT";
    if (DELETE_VERBS.has(lower)) return "DELETE";
    return "POST"; // default
}

export class HTTPAPIConnector implements ServiceConnector {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl.replace(/\/$/, ""); // strip trailing slash
    }

    async call(verb: string, description: string, params: Map<string, FlowValue>, path?: string, headers?: Record<string, string>): Promise<ServiceResponse> {
        const method = inferHTTPMethod(verb);
        let url = this.baseUrl;

        if (path) {
            url += path.startsWith("/") ? path : "/" + path;
        }

        // Serialize params
        const serialized: Record<string, unknown> = {};
        for (const [k, v] of params) {
            serialized[k] = flowValueToJson(v);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            let response: Response;

            if (method === "GET" || method === "DELETE") {
                // Params become query string
                const queryParts: string[] = [];
                for (const [k, v] of Object.entries(serialized)) {
                    queryParts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                }
                if (queryParts.length > 0) {
                    url += (url.includes("?") ? "&" : "?") + queryParts.join("&");
                }
                response = await fetch(url, {
                    method,
                    headers: { "Accept": "application/json", ...headers },
                    signal: controller.signal,
                });
            } else {
                // POST/PUT: params become JSON body
                response = await fetch(url, {
                    method,
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        ...headers,
                    },
                    body: JSON.stringify({
                        verb,
                        description,
                        ...serialized,
                    }),
                    signal: controller.signal,
                });
            }

            if (!response.ok) {
                const body = await response.text().catch(() => "");
                throw new Error(`Service returned error ${response.status}: ${body || response.statusText}`);
            }

            // Collect response headers
            const responseHeaders: Record<string, string> = {};
            response.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });

            const contentType = response.headers.get("content-type") ?? "";
            if (contentType.includes("application/json")) {
                const data = await response.json() as unknown;
                return { value: jsonToFlowValue(data), status: response.status, headers: responseHeaders };
            }

            // Non-JSON response: return as text
            const textBody = await response.text();
            return { value: text(textBody), status: response.status, headers: responseHeaders };
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`Request to ${this.baseUrl} timed out after 30 seconds`);
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }
}

export class WebhookConnector implements ServiceConnector {
    private url: string;

    constructor(url: string) {
        this.url = url;
    }

    async call(verb: string, description: string, params: Map<string, FlowValue>, _path?: string, headers?: Record<string, string>): Promise<ServiceResponse> {
        const serialized: Record<string, unknown> = {};
        for (const [k, v] of params) {
            serialized[k] = flowValueToJson(v);
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        try {
            const response = await fetch(this.url, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: JSON.stringify({ verb, description, ...serialized }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const body = await response.text().catch(() => "");
                throw new Error(`Webhook returned error ${response.status}: ${body || response.statusText}`);
            }

            return { value: record({ status: text("ok") }), status: response.status };
        } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error(`Webhook at ${this.url} timed out after 30 seconds`);
            }
            throw err;
        } finally {
            clearTimeout(timeout);
        }
    }
}

export class PluginStubConnector implements ServiceConnector {
    async call(verb: string, description: string, _params: Map<string, FlowValue>): Promise<ServiceResponse> {
        // Plugin connectors are not yet implemented — fall back to mock behavior
        return {
            value: record({
                status: text("ok"),
                data: text(`mock plugin response for: ${verb} ${description}`),
            }),
        };
    }
}

// ============================================================
// Database Connector
// ============================================================

const VALID_TABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function flowValueToSqlite(value: FlowValue): string | number | null {
    switch (value.type) {
        case "text": return value.value;
        case "number": return value.value;
        case "boolean": return value.value ? 1 : 0;
        case "empty": return null;
        default: return JSON.stringify(flowValueToJson(value));
    }
}

function sqliteRowToFlowRecord(row: Record<string, unknown>): FlowRecord {
    const map = new Map<string, FlowValue>();
    for (const [k, v] of Object.entries(row)) {
        if (v === null || v === undefined) {
            map.set(k, EMPTY);
        } else if (typeof v === "string") {
            map.set(k, text(v));
        } else if (typeof v === "number") {
            map.set(k, num(v));
        } else {
            map.set(k, text(String(v)));
        }
    }
    return { type: "record", value: map };
}

interface BetterSqliteDatabase {
    prepare(sql: string): BetterSqliteStatement;
    pragma(pragma: string): unknown;
    close(): void;
}

interface BetterSqliteStatement {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

export class DatabaseConnector implements ServiceConnector {
    private dbPath: string;
    private db: BetterSqliteDatabase | null = null;

    constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    private async ensureDb(): Promise<BetterSqliteDatabase> {
        if (this.db) return this.db;

        let BetterSqlite3: (path: string) => BetterSqliteDatabase;
        try {
            const mod = await import("better-sqlite3");
            BetterSqlite3 = mod.default as unknown as (path: string) => BetterSqliteDatabase;
        } catch {
            throw new Error(
                'The "better-sqlite3" package is required for database services. ' +
                "Install it with: npm install better-sqlite3"
            );
        }

        this.db = BetterSqlite3(this.dbPath);
        this.db.pragma("journal_mode = WAL");
        return this.db;
    }

    async call(verb: string, _description: string, params: Map<string, FlowValue>, path?: string): Promise<ServiceResponse> {
        const db = await this.ensureDb();
        const lower = verb.toLowerCase();

        // SQL mode: raw query via `with query "..."` param
        const queryParam = params.get("query");
        if (queryParam && queryParam.type === "text") {
            return this.executeSqlMode(db, lower, queryParam.value, params);
        }

        // Table mode: path is the table name
        if (!path) {
            throw new Error(
                `Database call "${verb}" requires a table name. ` +
                `Use: ${verb} ... using <DB> at "tablename" with ...`
            );
        }

        const tableName = path.replace(/^\//, "");
        if (!VALID_TABLE_NAME.test(tableName)) {
            throw new Error(
                `Invalid table name "${tableName}". ` +
                "Table names must start with a letter or underscore and contain only letters, digits, and underscores."
            );
        }

        return this.executeTableMode(db, lower, tableName, params);
    }

    private executeSqlMode(
        db: BetterSqliteDatabase,
        lower: string,
        sql: string,
        params: Map<string, FlowValue>,
    ): ServiceResponse {
        // Build named bindings from remaining params (exclude "query")
        const bindings: Record<string, string | number | null> = {};
        for (const [k, v] of params) {
            if (k === "query") continue;
            // Convert hyphens to underscores for SQLite bind param names
            const bindKey = k.replace(/-/g, "_");
            bindings[bindKey] = flowValueToSqlite(v);
        }

        const stmt = db.prepare(sql);
        const isSelect = DB_SELECT_SINGLE_VERBS.has(lower) ||
            DB_SELECT_MULTI_VERBS.has(lower) ||
            DB_COUNT_VERBS.has(lower) ||
            sql.trimStart().toUpperCase().startsWith("SELECT");

        if (isSelect) {
            if (DB_SELECT_SINGLE_VERBS.has(lower)) {
                const row = stmt.get(bindings);
                return { value: row ? sqliteRowToFlowRecord(row) : EMPTY };
            }
            if (DB_COUNT_VERBS.has(lower)) {
                const row = stmt.get(bindings);
                if (row) {
                    const firstVal = Object.values(row)[0];
                    return { value: num(Number(firstVal)) };
                }
                return { value: num(0) };
            }
            const rows = stmt.all(bindings);
            return { value: list(rows.map(sqliteRowToFlowRecord)) };
        }

        const result = stmt.run(bindings);
        if (DB_INSERT_VERBS.has(lower)) {
            return { value: record({ id: num(Number(result.lastInsertRowid)) }) };
        }
        return { value: record({ changes: num(result.changes) }) };
    }

    private executeTableMode(
        db: BetterSqliteDatabase,
        lower: string,
        tableName: string,
        params: Map<string, FlowValue>,
    ): ServiceResponse {
        if (DB_SELECT_SINGLE_VERBS.has(lower)) {
            return this.selectSingle(db, tableName, params);
        }
        if (DB_SELECT_MULTI_VERBS.has(lower)) {
            return this.selectMulti(db, tableName, params);
        }
        if (DB_COUNT_VERBS.has(lower)) {
            return this.countRows(db, tableName, params);
        }
        if (DB_INSERT_VERBS.has(lower)) {
            return this.insertRow(db, tableName, params);
        }
        if (DB_UPDATE_VERBS.has(lower)) {
            return this.updateRow(db, tableName, params);
        }
        if (DB_DELETE_VERBS.has(lower)) {
            return this.deleteRows(db, tableName, params);
        }

        // Unknown verb — default to select
        return this.selectMulti(db, tableName, params);
    }

    private buildWhereClause(params: Map<string, FlowValue>): { sql: string; bindings: Record<string, string | number | null> } {
        const conditions: string[] = [];
        const bindings: Record<string, string | number | null> = {};
        for (const [k, v] of params) {
            const bindKey = k.replace(/-/g, "_");
            conditions.push(`"${k}" = :${bindKey}`);
            bindings[bindKey] = flowValueToSqlite(v);
        }
        const sql = conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
        return { sql, bindings };
    }

    private selectSingle(db: BetterSqliteDatabase, table: string, params: Map<string, FlowValue>): ServiceResponse {
        const where = this.buildWhereClause(params);
        const stmt = db.prepare(`SELECT * FROM "${table}"${where.sql} LIMIT 1`);
        const row = stmt.get(where.bindings);
        return { value: row ? sqliteRowToFlowRecord(row) : EMPTY };
    }

    private selectMulti(db: BetterSqliteDatabase, table: string, params: Map<string, FlowValue>): ServiceResponse {
        const where = this.buildWhereClause(params);
        const stmt = db.prepare(`SELECT * FROM "${table}"${where.sql}`);
        const rows = stmt.all(where.bindings);
        return { value: list(rows.map(sqliteRowToFlowRecord)) };
    }

    private countRows(db: BetterSqliteDatabase, table: string, params: Map<string, FlowValue>): ServiceResponse {
        const where = this.buildWhereClause(params);
        const stmt = db.prepare(`SELECT COUNT(*) as count FROM "${table}"${where.sql}`);
        const row = stmt.get(where.bindings) as Record<string, unknown> | undefined;
        return { value: num(Number(row?.["count"] ?? 0)) };
    }

    private insertRow(db: BetterSqliteDatabase, table: string, params: Map<string, FlowValue>): ServiceResponse {
        const columns: string[] = [];
        const placeholders: string[] = [];
        const bindings: Record<string, string | number | null> = {};
        for (const [k, v] of params) {
            const bindKey = k.replace(/-/g, "_");
            columns.push(`"${k}"`);
            placeholders.push(`:${bindKey}`);
            bindings[bindKey] = flowValueToSqlite(v);
        }
        const sql = `INSERT INTO "${table}" (${columns.join(", ")}) VALUES (${placeholders.join(", ")})`;
        const result = db.prepare(sql).run(bindings);
        return { value: record({ id: num(Number(result.lastInsertRowid)) }) };
    }

    private updateRow(db: BetterSqliteDatabase, table: string, params: Map<string, FlowValue>): ServiceResponse {
        const setClauses: string[] = [];
        const bindings: Record<string, string | number | null> = {};
        let idValue: string | number | null = null;

        for (const [k, v] of params) {
            const bindKey = k.replace(/-/g, "_");
            bindings[bindKey] = flowValueToSqlite(v);
            if (k === "id") {
                idValue = flowValueToSqlite(v);
            } else {
                setClauses.push(`"${k}" = :${bindKey}`);
            }
        }

        if (idValue === null) {
            throw new Error(
                'UPDATE requires an "id" parameter for the WHERE clause. ' +
                "For updates with a different primary key, use SQL mode with the query parameter."
            );
        }
        if (setClauses.length === 0) {
            throw new Error("UPDATE requires at least one field to set besides id.");
        }

        const sql = `UPDATE "${table}" SET ${setClauses.join(", ")} WHERE "id" = :id`;
        const result = db.prepare(sql).run(bindings);
        return { value: record({ changes: num(result.changes) }) };
    }

    private deleteRows(db: BetterSqliteDatabase, table: string, params: Map<string, FlowValue>): ServiceResponse {
        const where = this.buildWhereClause(params);
        if (where.sql === "") {
            throw new Error(
                "DELETE requires at least one parameter for the WHERE clause. " +
                "To delete all rows, use SQL mode with the query parameter."
            );
        }
        const sql = `DELETE FROM "${table}"${where.sql}`;
        const result = db.prepare(sql).run(where.bindings);
        return { value: record({ changes: num(result.changes) }) };
    }
}

// ============================================================
// AI Connectors
// ============================================================

const AI_SYSTEM_PROMPT = `You are a workflow assistant. Respond ONLY with a JSON object containing:
- "result": your response as a string
- "confidence": a number between 0 and 1 indicating your confidence

Example: {"result": "The application looks good", "confidence": 0.92}`;

function buildAIContext(params: Map<string, FlowValue>): string {
    if (params.size === 0) return "";
    const parts: string[] = [];
    for (const [k, v] of params) {
        parts.push(`${k}: ${toDisplay(v)}`);
    }
    return "\n\nContext:\n" + parts.join("\n");
}

function parseAIResponse(responseText: string): FlowValue {
    try {
        const parsed = JSON.parse(responseText) as Record<string, unknown>;
        return record({
            result: text(String(parsed["result"] ?? responseText)),
            confidence: num(Number(parsed["confidence"] ?? 0.5)),
        });
    } catch {
        return record({
            result: text(responseText),
            confidence: num(0.5),
        });
    }
}

export class AnthropicConnector implements ServiceConnector {
    private model: string;
    private apiKey: string | undefined;

    constructor(target: string, apiKey: string | undefined) {
        this.model = target.startsWith("anthropic/") ? target.slice(10) : target;
        this.apiKey = apiKey;
    }

    getModel(): string {
        return this.model;
    }

    async call(_verb: string, description: string, params: Map<string, FlowValue>): Promise<ServiceResponse> {
        if (!this.apiKey) {
            throw new Error("Missing API key. Set ANTHROPIC_API_KEY in your .env file.");
        }

        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const client = new Anthropic({ apiKey: this.apiKey });

        const userMessage = description + buildAIContext(params);

        const message = await client.messages.create({
            model: this.model,
            max_tokens: 1024,
            system: AI_SYSTEM_PROMPT,
            messages: [{ role: "user", content: userMessage }],
        });

        const textBlock = message.content.find((b: { type: string }) => b.type === "text");
        const responseText = textBlock && "text" in textBlock ? (textBlock as { type: "text"; text: string }).text : "";

        return { value: parseAIResponse(responseText) };
    }
}

export class OpenAIConnector implements ServiceConnector {
    private model: string;
    private apiKey: string | undefined;

    constructor(target: string, apiKey: string | undefined) {
        this.model = target.startsWith("openai/") ? target.slice(7) : target;
        this.apiKey = apiKey;
    }

    getModel(): string {
        return this.model;
    }

    async call(_verb: string, description: string, params: Map<string, FlowValue>): Promise<ServiceResponse> {
        if (!this.apiKey) {
            throw new Error("Missing API key. Set OPENAI_API_KEY in your .env file.");
        }

        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: this.apiKey });

        const userMessage = description + buildAIContext(params);

        const response = await client.chat.completions.create({
            model: this.model,
            max_tokens: 1024,
            messages: [
                { role: "system", content: AI_SYSTEM_PROMPT },
                { role: "user", content: userMessage },
            ],
        });

        const responseText = response.choices[0]?.message?.content ?? "";

        return { value: parseAIResponse(responseText) };
    }
}

// ============================================================
// Connector factory
// ============================================================

export function buildConnectors(
    declarations: ServiceDeclaration[]
): Map<string, ServiceConnector> {
    const connectors = new Map<string, ServiceConnector>();
    for (const decl of declarations) {
        switch (decl.serviceType) {
            case "api":
                connectors.set(decl.name, new HTTPAPIConnector(decl.target));
                break;
            case "webhook":
                connectors.set(decl.name, new WebhookConnector(decl.target));
                break;
            case "plugin":
                connectors.set(decl.name, new PluginStubConnector());
                break;
            case "ai":
                if (decl.target.startsWith("anthropic/")) {
                    connectors.set(decl.name, new AnthropicConnector(decl.target, process.env.ANTHROPIC_API_KEY));
                } else if (decl.target.startsWith("openai/")) {
                    connectors.set(decl.name, new OpenAIConnector(decl.target, process.env.OPENAI_API_KEY));
                } else {
                    connectors.set(decl.name, createMockConnector("ai"));
                }
                break;
            case "database":
                connectors.set(decl.name, new DatabaseConnector(decl.target));
                break;
        }
    }
    return connectors;
}

// ============================================================
// Flow control signals
// ============================================================

class CompleteSignal {
    constructor(public outputs: Record<string, FlowValue>) {}
}

class RejectSignal {
    constructor(public message: string) {}
}

// ============================================================
// Execution context
// ============================================================

interface ExecutionContext {
    env: Environment;
    connectors: Map<string, ServiceConnector>;
    resolvedHeaders: Map<string, Record<string, string>>;
    log: LogEntry[];
    currentStep: string | null;
    source: string;
    fileName: string;
    verbose: boolean;
    strictEnv: boolean;
}

// ============================================================
// Expression evaluator (stays synchronous)
// ============================================================

function evaluateExpression(expr: Expression, ctx: ExecutionContext): FlowValue {
    switch (expr.kind) {
        case "StringLiteral":
            return text(expr.value);

        case "NumberLiteral":
            return num(expr.value);

        case "BooleanLiteral":
            return bool(expr.value);

        case "Identifier": {
            const val = ctx.env.get(expr.name);
            if (val === undefined) {
                throw new RuntimeError(
                    `The variable "${expr.name}" hasn't been set yet.`,
                    expr.loc, ctx.source, ctx.fileName
                );
            }
            return val;
        }

        case "DotAccess":
            return evaluateDotAccess(expr, ctx);

        case "InterpolatedString":
            return evaluateInterpolatedString(expr, ctx);

        case "MathExpression":
            return evaluateMath(expr, ctx);

        case "ComparisonExpression":
            return evaluateComparison(expr, ctx);

        case "LogicalExpression":
            return evaluateLogical(expr, ctx);
    }
}

function evaluateDotAccess(expr: Expression, ctx: ExecutionContext): FlowValue {
    if (expr.kind !== "DotAccess") {
        return evaluateExpression(expr, ctx);
    }

    // Build the full dot-access chain
    const parts: string[] = [expr.property];
    let current = expr.object;
    while (current.kind === "DotAccess") {
        parts.unshift(current.property);
        current = current.object;
    }

    // The root should be an identifier
    if (current.kind !== "Identifier") {
        throw new RuntimeError(
            "I can only access fields on variables, not on other expressions.",
            expr.loc, ctx.source, ctx.fileName
        );
    }

    const rootName = current.name;
    let value = ctx.env.get(rootName);
    if (value === undefined) {
        // Return empty for undefined root (lenient for trigger data)
        return EMPTY;
    }

    // Traverse the chain
    const isEnvAccess = rootName === "env";
    for (const part of parts) {
        if (value.type === "record") {
            const field = value.value.get(part);
            if (field === undefined) {
                if (isEnvAccess && ctx.strictEnv) {
                    throw new RuntimeError(
                        `The environment variable "${part}" is not set. Add it to your .env file or set it in your system environment.`,
                        expr.loc, ctx.source, ctx.fileName
                    );
                }
                if (isEnvAccess && ctx.verbose) {
                    addLogEntry(ctx, "env warning", "skipped", { message: `Environment variable "${part}" is not set` });
                }
                return EMPTY;
            }
            value = field;
        } else if (value.type === "empty") {
            return EMPTY;
        } else {
            throw new RuntimeError(
                `I can't access ".${part}" on a ${value.type} value. Only records have fields.`,
                expr.loc, ctx.source, ctx.fileName
            );
        }
    }

    return value;
}

function evaluateInterpolatedString(expr: Expression & { kind: "InterpolatedString" }, ctx: ExecutionContext): FlowValue {
    let result = "";
    for (const part of expr.parts) {
        if (part.kind === "text") {
            result += part.value;
        } else {
            const val = evaluateExpression(part.value, ctx);
            result += toDisplay(val);
        }
    }
    return text(result);
}

function evaluateMath(expr: Expression & { kind: "MathExpression" }, ctx: ExecutionContext): FlowValue {
    const left = evaluateExpression(expr.left, ctx);
    const right = evaluateExpression(expr.right, ctx);

    // Special case: text + text with "plus" means concatenation
    if (expr.operator === "plus" && left.type === "text" && right.type === "text") {
        return text(left.value + right.value);
    }

    const leftNum = asNumber(left, expr.left.loc, ctx);
    const rightNum = asNumber(right, expr.right.loc, ctx);

    switch (expr.operator) {
        case "plus": return num(leftNum + rightNum);
        case "minus": return num(leftNum - rightNum);
        case "times": return num(leftNum * rightNum);
        case "divided by": {
            if (rightNum === 0) {
                throw new RuntimeError(
                    "I can't divide by zero.",
                    expr.right.loc, ctx.source, ctx.fileName
                );
            }
            return num(leftNum / rightNum);
        }
        case "rounded to": return num(Number(leftNum.toFixed(rightNum)));
    }
}

function evaluateComparison(expr: Expression & { kind: "ComparisonExpression" }, ctx: ExecutionContext): FlowValue {
    const left = evaluateExpression(expr.left, ctx);

    switch (expr.operator) {
        // Unary operators
        case "is empty":
            return bool(!isTruthy(left));
        case "is not empty":
            return bool(isTruthy(left));
        case "exists":
            return bool(left.type !== "empty");
        case "does not exist":
            return bool(left.type === "empty");

        // Binary operators
        case "is": {
            const right = evaluateExpression(expr.right!, ctx);
            return bool(flowValuesEqual(left, right));
        }
        case "is not": {
            const right = evaluateExpression(expr.right!, ctx);
            return bool(!flowValuesEqual(left, right));
        }
        case "is above": {
            const right = evaluateExpression(expr.right!, ctx);
            return bool(asNumber(left, expr.left.loc, ctx) > asNumber(right, expr.right!.loc, ctx));
        }
        case "is below": {
            const right = evaluateExpression(expr.right!, ctx);
            return bool(asNumber(left, expr.left.loc, ctx) < asNumber(right, expr.right!.loc, ctx));
        }
        case "is at least": {
            const right = evaluateExpression(expr.right!, ctx);
            return bool(asNumber(left, expr.left.loc, ctx) >= asNumber(right, expr.right!.loc, ctx));
        }
        case "is at most": {
            const right = evaluateExpression(expr.right!, ctx);
            return bool(asNumber(left, expr.left.loc, ctx) <= asNumber(right, expr.right!.loc, ctx));
        }
        case "contains": {
            const right = evaluateExpression(expr.right!, ctx);
            if (left.type === "text" && right.type === "text") {
                return bool(left.value.includes(right.value));
            }
            if (left.type === "list") {
                return bool(left.value.some(item => flowValuesEqual(item, right)));
            }
            throw new RuntimeError(
                `I can't use "contains" on a ${left.type} value. It works with text and lists.`,
                expr.loc, ctx.source, ctx.fileName
            );
        }
    }
}

function evaluateLogical(expr: Expression & { kind: "LogicalExpression" }, ctx: ExecutionContext): FlowValue {
    const left = evaluateExpression(expr.left, ctx);

    switch (expr.operator) {
        case "not":
            return bool(!isTruthy(left));
        case "and": {
            if (!isTruthy(left)) return bool(false);
            const right = evaluateExpression(expr.right!, ctx);
            return bool(isTruthy(right));
        }
        case "or": {
            if (isTruthy(left)) return bool(true);
            const right = evaluateExpression(expr.right!, ctx);
            return bool(isTruthy(right));
        }
    }
}

// ============================================================
// Statement executor (async — service calls return promises)
// ============================================================

async function executeStatements(stmts: Statement[], ctx: ExecutionContext): Promise<void> {
    for (const stmt of stmts) {
        await executeStatement(stmt, ctx);
    }
}

async function executeStatement(stmt: Statement, ctx: ExecutionContext): Promise<void> {
    switch (stmt.kind) {
        case "SetStatement":
            executeSetStatement(stmt, ctx);
            break;
        case "IfStatement":
            await executeIfStatement(stmt, ctx);
            break;
        case "ForEachStatement":
            await executeForEachStatement(stmt, ctx);
            break;
        case "ServiceCall":
            await executeServiceCall(stmt, ctx);
            break;
        case "AskStatement":
            await executeAskStatement(stmt, ctx);
            break;
        case "LogStatement":
            executeLogStatement(stmt, ctx);
            break;
        case "CompleteStatement":
            executeCompleteStatement(stmt, ctx);
            break;
        case "RejectStatement":
            executeRejectStatement(stmt, ctx);
            break;
        case "StepBlock":
            await executeStepBlock(stmt, ctx);
            break;
    }
}

function executeSetStatement(stmt: SetStatement, ctx: ExecutionContext): void {
    const value = evaluateExpression(stmt.value, ctx);
    ctx.env.set(stmt.variable, value);
}

async function executeIfStatement(stmt: IfStatement, ctx: ExecutionContext): Promise<void> {
    const condValue = evaluateExpression(stmt.condition, ctx);
    if (isTruthy(condValue)) {
        await executeStatements(stmt.body, ctx);
        return;
    }

    for (const oi of stmt.otherwiseIfs) {
        const oiValue = evaluateExpression(oi.condition, ctx);
        if (isTruthy(oiValue)) {
            await executeStatements(oi.body, ctx);
            return;
        }
    }

    if (stmt.otherwise) {
        await executeStatements(stmt.otherwise, ctx);
    }
}

async function executeForEachStatement(stmt: ForEachStatement, ctx: ExecutionContext): Promise<void> {
    const collection = evaluateExpression(stmt.collection, ctx);
    if (collection.type !== "list") {
        throw new RuntimeError(
            `I expected a list to loop over, but got ${collection.type} (${toDisplay(collection)}).`,
            stmt.collection.loc, ctx.source, ctx.fileName
        );
    }

    for (const item of collection.value) {
        const childEnv = ctx.env.createChild();
        childEnv.set(stmt.itemName, item);
        const childCtx: ExecutionContext = { ...ctx, env: childEnv };
        await executeStatements(stmt.body, childCtx);
    }
}

async function executeServiceCall(stmt: ServiceCall, ctx: ExecutionContext): Promise<void> {
    const connector = ctx.connectors.get(stmt.service);
    if (!connector) {
        throw new RuntimeError(
            `No connector found for service "${stmt.service}".`,
            stmt.loc, ctx.source, ctx.fileName
        );
    }

    // Evaluate parameters
    const params = new Map<string, FlowValue>();
    for (const param of stmt.parameters) {
        params.set(param.name, evaluateExpression(param.value, ctx));
    }

    // Evaluate path if present
    let path: string | undefined;
    if (stmt.path) {
        const pathValue = evaluateExpression(stmt.path, ctx);
        path = toDisplay(pathValue);
    }

    // Look up resolved headers for this service
    const serviceHeaders = ctx.resolvedHeaders.get(stmt.service);

    function storeServiceResponse(resp: ServiceResponse): void {
        if (stmt.resultVar) {
            ctx.env.set(stmt.resultVar, resp.value);
        }
        if (stmt.statusVar) {
            ctx.env.set(stmt.statusVar, resp.status !== undefined ? num(resp.status) : EMPTY);
        }
        if (stmt.headersVar) {
            if (resp.headers) {
                const headerEntries: Record<string, FlowValue> = {};
                for (const [k, v] of Object.entries(resp.headers)) {
                    headerEntries[k] = text(v);
                }
                ctx.env.set(stmt.headersVar, record(headerEntries));
            } else {
                ctx.env.set(stmt.headersVar, EMPTY);
            }
        }
    }

    if (stmt.errorHandler) {
        await executeWithErrorHandler(
            async () => {
                const callStart = performance.now();
                const resp = await connector.call(stmt.verb, stmt.description, params, path, serviceHeaders);
                const elapsed = Math.round(performance.now() - callStart);
                storeServiceResponse(resp);
                addLogEntry(ctx, stmt.verb + " " + stmt.description, "success", { service: stmt.service }, elapsed);
            },
            stmt.errorHandler,
            ctx,
            stmt.loc,
            { service: stmt.service, verb: stmt.verb, description: stmt.description }
        );
    } else {
        const callStart = performance.now();
        try {
            const resp = await connector.call(stmt.verb, stmt.description, params, path, serviceHeaders);
            const elapsed = Math.round(performance.now() - callStart);
            storeServiceResponse(resp);
            addLogEntry(ctx, stmt.verb + " " + stmt.description, "success", { service: stmt.service }, elapsed);
        } catch (err) {
            const elapsed = Math.round(performance.now() - callStart);
            const message = err instanceof Error ? err.message : String(err);
            addLogEntry(ctx, stmt.verb + " " + stmt.description, "failure", { service: stmt.service, error: message }, elapsed);
            throw new RuntimeError(
                `The service "${stmt.service}" failed: ${message}`,
                stmt.loc, ctx.source, ctx.fileName
            );
        }
    }
}

async function executeAskStatement(stmt: AskStatement, ctx: ExecutionContext): Promise<void> {
    const connector = ctx.connectors.get(stmt.agent);
    if (!connector) {
        throw new RuntimeError(
            `No connector found for agent "${stmt.agent}".`,
            stmt.loc, ctx.source, ctx.fileName
        );
    }

    const callStart = performance.now();
    try {
        const resp = await connector.call("ask", stmt.instruction, new Map());
        const elapsed = Math.round(performance.now() - callStart);
        const response = resp.value;
        addLogEntry(ctx, "ask " + stmt.agent, "success", { agent: stmt.agent, instruction: stmt.instruction }, elapsed);

        // Extract result and confidence from the response
        if (stmt.resultVar) {
            if (response.type === "record") {
                const resultVal = response.value.get("result") ?? response;
                ctx.env.set(stmt.resultVar, resultVal);
            } else {
                ctx.env.set(stmt.resultVar, response);
            }
        }
        if (stmt.confidenceVar) {
            if (response.type === "record") {
                const confVal = response.value.get("confidence") ?? EMPTY;
                ctx.env.set(stmt.confidenceVar, confVal);
            } else {
                ctx.env.set(stmt.confidenceVar, EMPTY);
            }
        }
    } catch (err) {
        const elapsed = Math.round(performance.now() - callStart);
        const message = err instanceof Error ? err.message : String(err);
        addLogEntry(ctx, "ask " + stmt.agent, "failure", { agent: stmt.agent, error: message }, elapsed);
        throw new RuntimeError(
            `The agent "${stmt.agent}" failed: ${message}`,
            stmt.loc, ctx.source, ctx.fileName
        );
    }
}

function executeLogStatement(stmt: LogStatement, ctx: ExecutionContext): void {
    const value = evaluateExpression(stmt.expression, ctx);
    const displayed = toDisplay(value);
    addLogEntry(ctx, "log", "success", { message: displayed });
}

function executeCompleteStatement(stmt: CompleteStatement, ctx: ExecutionContext): void {
    const outputs: Record<string, FlowValue> = {};
    for (const param of stmt.outputs) {
        outputs[param.name] = evaluateExpression(param.value, ctx);
    }
    throw new CompleteSignal(outputs);
}

function executeRejectStatement(stmt: RejectStatement, ctx: ExecutionContext): void {
    const value = evaluateExpression(stmt.message, ctx);
    throw new RejectSignal(toDisplay(value));
}

async function executeStepBlock(stmt: StepBlock, ctx: ExecutionContext): Promise<void> {
    const prevStep = ctx.currentStep;
    ctx.currentStep = stmt.name;
    addLogEntry(ctx, `step "${stmt.name}" started`, "success", {});
    const stepStart = performance.now();
    await executeStatements(stmt.body, ctx);
    const stepElapsed = Math.round(performance.now() - stepStart);
    addLogEntry(ctx, `step "${stmt.name}" completed`, "success", {}, stepElapsed);
    ctx.currentStep = prevStep;
}

// ============================================================
// Error handling (retry logic)
// ============================================================

async function executeWithErrorHandler(
    action: () => Promise<void>,
    handler: ErrorHandler,
    ctx: ExecutionContext,
    loc: SourceLocation,
    details: Record<string, unknown>,
): Promise<void> {
    const maxAttempts = 1 + (handler.retryCount ?? 0);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            await action();
            return; // Success
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            if (attempt < maxAttempts) {
                addLogEntry(ctx, `retry ${attempt}/${handler.retryCount}`, "failure", { ...details, error: message });
                if (handler.retryWaitSeconds) {
                    await new Promise(resolve => setTimeout(resolve, handler.retryWaitSeconds! * 1000));
                }
            }
        }
    }

    // All attempts failed
    if (handler.fallback) {
        addLogEntry(ctx, "executing fallback", "success", details);
        await executeStatements(handler.fallback, ctx);
    } else {
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        addLogEntry(ctx, "all retries failed", "failure", { ...details, error: message });
        throw new RuntimeError(
            `All ${maxAttempts} attempts failed: ${message}`,
            loc, ctx.source, ctx.fileName
        );
    }
}

// ============================================================
// Log helper
// ============================================================

function addLogEntry(ctx: ExecutionContext, action: string, result: LogEntry["result"], details: Record<string, unknown>, durationMs: number | null = null): void {
    ctx.log.push({
        timestamp: new Date(),
        step: ctx.currentStep,
        action,
        result,
        durationMs,
        details,
    });
}

// ============================================================
// Main execute function
// ============================================================

export interface RuntimeOptions {
    input?: Record<string, unknown>;
    connectors?: Map<string, ServiceConnector>;
    envVars?: Record<string, string>;
    verbose?: boolean;
    strictEnv?: boolean;
}

export async function execute(program: Program, source: string, options?: RuntimeOptions): Promise<ExecutionResult> {
    const fileName = "<input>";
    const log: LogEntry[] = [];

    if (!program.workflow) {
        return {
            result: { status: "completed", outputs: {} },
            log,
        };
    }

    // Set up the global environment
    const globalEnv = new Environment();

    // Add env variable (wraps environment variables)
    const envEntries: Record<string, FlowValue> = {};
    const envSource = options?.envVars ?? {};
    for (const [k, v] of Object.entries(envSource)) {
        envEntries[k] = text(v);
    }
    globalEnv.set("env", record(envEntries));

    // Add input data to the environment
    // The whole input is available as "request", and each top-level key
    // is also a direct variable. Keys are set after the wrapper so that
    // an explicit "request" key in the input takes precedence.
    if (options?.input) {
        const requestEntries: Record<string, FlowValue> = {};
        for (const [key, value] of Object.entries(options.input)) {
            requestEntries[key] = jsonToFlowValue(value);
        }
        globalEnv.set("request", record(requestEntries));
        for (const [key, value] of Object.entries(requestEntries)) {
            globalEnv.set(key, value);
        }
    }

    // Set up connectors
    const connectors = new Map<string, ServiceConnector>();
    if (options?.connectors) {
        for (const [name, connector] of options.connectors) {
            connectors.set(name, connector);
        }
    }

    // Create mock connectors for any services not already provided
    if (program.services) {
        for (const decl of program.services.declarations) {
            if (!connectors.has(decl.name)) {
                connectors.set(decl.name, createMockConnector(decl.serviceType));
            }
        }
    }

    // Resolve service headers (evaluate expressions using the global environment)
    const resolvedHeaders = new Map<string, Record<string, string>>();
    if (program.services) {
        const headerCtx: ExecutionContext = {
            env: globalEnv,
            connectors,
            resolvedHeaders,
            log,
            currentStep: null,
            source,
            fileName,
            verbose: options?.verbose ?? false,
            strictEnv: options?.strictEnv ?? false,
        };
        for (const decl of program.services.declarations) {
            if (decl.headers.length > 0) {
                const headers: Record<string, string> = {};
                for (const header of decl.headers) {
                    const value = evaluateExpression(header.value, headerCtx);
                    headers[header.name] = toDisplay(value);
                }
                resolvedHeaders.set(decl.name, headers);
            }
        }
    }

    // Build execution context
    const ctx: ExecutionContext = {
        env: globalEnv,
        connectors,
        resolvedHeaders,
        log,
        currentStep: null,
        source,
        fileName,
        verbose: options?.verbose ?? false,
        strictEnv: options?.strictEnv ?? false,
    };

    // Execute the workflow
    try {
        await executeStatements(program.workflow.body, ctx);
        // If we get here, no complete/reject was hit
        return {
            result: { status: "completed", outputs: {} },
            log,
        };
    } catch (signal) {
        if (signal instanceof CompleteSignal) {
            return {
                result: { status: "completed", outputs: signal.outputs },
                log,
            };
        }
        if (signal instanceof RejectSignal) {
            return {
                result: { status: "rejected", message: signal.message },
                log,
            };
        }
        if (signal instanceof RuntimeError) {
            return {
                result: { status: "error", error: signal.flowError },
                log,
            };
        }
        // Unexpected error
        const message = signal instanceof Error ? signal.message : String(signal);
        return {
            result: {
                status: "error",
                error: createError(fileName, 1, 1, `Unexpected error: ${message}`, source),
            },
            log,
        };
    }
}
