import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import {
    execute,
    text, num, record, list, EMPTY,
    MockDatabaseConnector,
    DatabaseConnector,
    type ServiceConnector,
} from "../../src/runtime/index.js";
import type { ExecutionResult, FlowValue } from "../../src/types/index.js";

// ============================================================
// Helpers
// ============================================================

async function run(source: string, options?: Parameters<typeof execute>[2]): Promise<ExecutionResult> {
    const tokens = tokenize(source);
    const { program } = parse(tokens, source);
    return await execute(program, source, options);
}

async function runOk(source: string, options?: Parameters<typeof execute>[2]): Promise<ExecutionResult> {
    const result = await run(source, options);
    if (result.result.status === "error") {
        throw new Error(`Unexpected runtime error: ${result.result.error.message}`);
    }
    return result;
}

function logMessages(result: ExecutionResult): string[] {
    return result.log
        .filter(e => e.action === "log" && e.details["message"])
        .map(e => e.details["message"] as string);
}

// ============================================================
// MockDatabaseConnector
// ============================================================

describe("MockDatabaseConnector", () => {
    it("returns a single record for get/fetch/find/check verbs", async () => {
        const conn = new MockDatabaseConnector();
        const resp = await conn.call("get", "user", new Map());
        expect(resp.value.type).toBe("record");
    });

    it("returns a list for list/search/query verbs", async () => {
        const conn = new MockDatabaseConnector();
        const resp = await conn.call("list", "users", new Map());
        expect(resp.value.type).toBe("list");
        if (resp.value.type === "list") {
            expect(resp.value.value.length).toBe(2);
        }
    });

    it("returns a number for count verb", async () => {
        const conn = new MockDatabaseConnector();
        const resp = await conn.call("count", "orders", new Map());
        expect(resp.value.type).toBe("number");
        if (resp.value.type === "number") {
            expect(resp.value.value).toBe(42);
        }
    });

    it("returns { id } record for insert verb", async () => {
        const conn = new MockDatabaseConnector();
        const resp = await conn.call("insert", "record", new Map());
        expect(resp.value.type).toBe("record");
    });

    it("returns { changes } record for update verb", async () => {
        const conn = new MockDatabaseConnector();
        const resp = await conn.call("update", "record", new Map());
        expect(resp.value.type).toBe("record");
    });

    it("returns { changes } record for delete verb", async () => {
        const conn = new MockDatabaseConnector();
        const resp = await conn.call("delete", "record", new Map());
        expect(resp.value.type).toBe("record");
    });

    it("respects failCount option", async () => {
        const conn = new MockDatabaseConnector({ failCount: 1 });
        await expect(conn.call("get", "user", new Map())).rejects.toThrow("mock failure");
        // Second call succeeds
        const resp = await conn.call("get", "user", new Map());
        expect(resp.value.type).toBe("record");
    });
});

// ============================================================
// DatabaseConnector (real SQLite with temp file)
// ============================================================

describe("DatabaseConnector — real SQLite", () => {
    const dbPath = join(tmpdir(), `flow-test-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
    let conn: DatabaseConnector;

    beforeEach(async () => {
        conn = new DatabaseConnector(dbPath);

        // Create a test table by running raw SQL
        const params = new Map<string, FlowValue>();
        params.set("query", text(
            'CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, stock INTEGER DEFAULT 0, status TEXT DEFAULT "active")'
        ));
        await conn.call("run", "setup", params);

        // Insert test data
        const insert1 = new Map<string, FlowValue>();
        insert1.set("name", text("Widget"));
        insert1.set("stock", num(100));
        insert1.set("status", text("active"));
        await conn.call("insert", "product", insert1, "products");

        const insert2 = new Map<string, FlowValue>();
        insert2.set("name", text("Gadget"));
        insert2.set("stock", num(0));
        insert2.set("status", text("discontinued"));
        await conn.call("insert", "product", insert2, "products");

        const insert3 = new Map<string, FlowValue>();
        insert3.set("name", text("Doohickey"));
        insert3.set("stock", num(50));
        insert3.set("status", text("active"));
        await conn.call("insert", "product", insert3, "products");
    });

    afterEach(() => {
        if (existsSync(dbPath)) {
            unlinkSync(dbPath);
        }
    });

    it("gets a single row", async () => {
        const params = new Map<string, FlowValue>();
        params.set("name", text("Widget"));
        const resp = await conn.call("get", "product", params, "products");
        expect(resp.value.type).toBe("record");
        if (resp.value.type === "record") {
            expect(resp.value.value.get("name")).toEqual(text("Widget"));
            expect(resp.value.value.get("stock")).toEqual(num(100));
        }
    });

    it("returns empty for missing row", async () => {
        const params = new Map<string, FlowValue>();
        params.set("name", text("Nonexistent"));
        const resp = await conn.call("get", "product", params, "products");
        expect(resp.value.type).toBe("empty");
    });

    it("lists multiple rows", async () => {
        const params = new Map<string, FlowValue>();
        params.set("status", text("active"));
        const resp = await conn.call("list", "products", params, "products");
        expect(resp.value.type).toBe("list");
        if (resp.value.type === "list") {
            expect(resp.value.value.length).toBe(2);
        }
    });

    it("counts rows", async () => {
        const params = new Map<string, FlowValue>();
        const resp = await conn.call("count", "products", params, "products");
        expect(resp.value.type).toBe("number");
        if (resp.value.type === "number") {
            expect(resp.value.value).toBe(3);
        }
    });

    it("inserts a row and returns the id", async () => {
        const params = new Map<string, FlowValue>();
        params.set("name", text("Thingamajig"));
        params.set("stock", num(25));
        const resp = await conn.call("insert", "record", params, "products");
        expect(resp.value.type).toBe("record");
        if (resp.value.type === "record") {
            const id = resp.value.value.get("id");
            expect(id).toBeDefined();
            expect(id?.type).toBe("number");
            if (id?.type === "number") {
                expect(id.value).toBe(4);
            }
        }
    });

    it("updates a row by id", async () => {
        const params = new Map<string, FlowValue>();
        params.set("id", num(1));
        params.set("stock", num(200));
        const resp = await conn.call("update", "record", params, "products");
        expect(resp.value.type).toBe("record");
        if (resp.value.type === "record") {
            expect(resp.value.value.get("changes")).toEqual(num(1));
        }

        // Verify the update
        const getParams = new Map<string, FlowValue>();
        getParams.set("id", num(1));
        const verify = await conn.call("get", "product", getParams, "products");
        if (verify.value.type === "record") {
            expect(verify.value.value.get("stock")).toEqual(num(200));
        }
    });

    it("deletes rows", async () => {
        const params = new Map<string, FlowValue>();
        params.set("status", text("discontinued"));
        const resp = await conn.call("delete", "records", params, "products");
        expect(resp.value.type).toBe("record");
        if (resp.value.type === "record") {
            expect(resp.value.value.get("changes")).toEqual(num(1));
        }
    });

    it("executes raw SQL with named bindings", async () => {
        const params = new Map<string, FlowValue>();
        params.set("query", text("SELECT COUNT(*) as total FROM products WHERE stock > :min_stock"));
        params.set("min_stock", num(10));
        const resp = await conn.call("count", "products", params);
        expect(resp.value.type).toBe("number");
        if (resp.value.type === "number") {
            expect(resp.value.value).toBe(2);
        }
    });

    it("rejects invalid table names", async () => {
        const params = new Map<string, FlowValue>();
        await expect(
            conn.call("get", "data", params, "invalid table!")
        ).rejects.toThrow("Invalid table name");
    });

    it("requires id param for update", async () => {
        const params = new Map<string, FlowValue>();
        params.set("stock", num(999));
        await expect(
            conn.call("update", "record", params, "products")
        ).rejects.toThrow("requires an \"id\" parameter");
    });

    it("requires at least one param for delete", async () => {
        const params = new Map<string, FlowValue>();
        await expect(
            conn.call("delete", "records", params, "products")
        ).rejects.toThrow("requires at least one parameter");
    });
});

// ============================================================
// Integration: database service in a .flow program
// ============================================================

describe("Database — flow integration (mock)", () => {
    it("uses mock database connector for get verb", async () => {
        const source = [
            "services:",
            '    DB is a database at "./test.sqlite"',
            "",
            "workflow:",
            '    get user using DB at "users" with id 1',
            "        save the result as user",
            "    log user",
        ].join("\n");

        const connectors = new Map<string, ServiceConnector>();
        connectors.set("DB", new MockDatabaseConnector());

        const result = await runOk(source, { connectors });
        expect(result.result.status).not.toBe("error");
    });

    it("uses mock database connector for count verb", async () => {
        const source = [
            "services:",
            '    DB is a database at "./test.sqlite"',
            "",
            "workflow:",
            '    count orders using DB at "orders"',
            "        save the result as total",
            "    log total",
        ].join("\n");

        const connectors = new Map<string, ServiceConnector>();
        connectors.set("DB", new MockDatabaseConnector());

        const result = await runOk(source, { connectors });
        const logs = logMessages(result);
        expect(logs[0]).toBe("42");
    });
});
