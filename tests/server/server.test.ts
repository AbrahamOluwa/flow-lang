import { describe, it, expect } from "vitest";
import request from "supertest";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { tokenize } from "../../src/lexer/index.js";
import { parse } from "../../src/parser/index.js";
import { analyze } from "../../src/analyzer/index.js";
import { createApp } from "../../src/server/index.js";
import type { LoadedWorkflow, ServeOptions } from "../../src/server/index.js";
import type { Application } from "express";

// ============================================================
// Helpers
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const examplesDir = resolve(__dirname, "../../examples");

const defaultOptions: ServeOptions = { port: 0, verbose: false, mock: true };

function buildWorkflow(source: string, name = "test"): LoadedWorkflow {
    const tokens = tokenize(source);
    const { program, errors: parseErrors } = parse(tokens, source);
    const analysisErrors = analyze(program, source);
    const allErrors = [...parseErrors, ...analysisErrors];
    if (allErrors.length > 0) {
        throw new Error(`Flow validation errors: ${allErrors.map(e => e.message).join("; ")}`);
    }

    const nameEntry = program.config?.entries.find(e => e.key === "name");
    const versionEntry = program.config?.entries.find(e => e.key === "version");

    return {
        name: nameEntry ? String(nameEntry.value) : name,
        version: versionEntry?.value ?? null,
        trigger: program.workflow?.trigger?.description ?? null,
        filePath: "<test>",
        program,
        source,
    };
}

function buildTestApp(source: string, options?: Partial<ServeOptions>): Application {
    const workflow = buildWorkflow(source);
    return createApp(
        new Map([["", workflow]]),
        { ...defaultOptions, ...options },
    );
}

function loadExampleWorkflow(filename: string): LoadedWorkflow {
    const filePath = resolve(examplesDir, filename);
    const source = readFileSync(filePath, "utf-8");
    return buildWorkflow(source, filename.replace(".flow", ""));
}

function buildDirectoryApp(options?: Partial<ServeOptions>): Application {
    const workflows = new Map<string, LoadedWorkflow>();
    for (const file of ["email-verification.flow", "order-processing.flow", "loan-application.flow"]) {
        const wf = loadExampleWorkflow(file);
        workflows.set(file.replace(".flow", ""), wf);
    }
    return createApp(workflows, { ...defaultOptions, ...options });
}

// ============================================================
// Health check and metadata
// ============================================================

describe("Server — Health check and metadata", () => {
    it("GET /health returns ok status", async () => {
        const app = buildTestApp(`
workflow:
    complete with status "ok"
`);
        const res = await request(app).get("/health");
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: "ok" });
    });

    it("GET / for single-file returns workflow metadata", async () => {
        const app = buildTestApp(`
config:
    name: "My Workflow"
    version: 2

workflow:
    trigger: when a form is submitted
    complete with status "done"
`);
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.body.name).toBe("My Workflow");
        expect(res.body.version).toBe(2);
        expect(res.body.trigger).toBe("when a form is submitted");
    });

    it("GET / for directory returns list of workflows", async () => {
        const app = buildDirectoryApp();
        const res = await request(app).get("/");
        expect(res.status).toBe(200);
        expect(res.body.workflows).toBeInstanceOf(Array);
        expect(res.body.workflows.length).toBe(3);
        const routes = res.body.workflows.map((w: { route: string }) => w.route);
        expect(routes).toContain("/email-verification");
        expect(routes).toContain("/order-processing");
        expect(routes).toContain("/loan-application");
    });
});

// ============================================================
// Single-file execution
// ============================================================

describe("Server — Single-file workflow execution", () => {
    it("POST / with valid input returns 200 with completed outputs", async () => {
        const app = buildTestApp(`
workflow:
    trigger: when a request is received
    set name to request.name
    complete with greeting "hello" and name name
`);
        const res = await request(app)
            .post("/")
            .send({ request: { name: "Alice" } });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("completed");
        expect(res.body.outputs.greeting).toBe("hello");
        expect(res.body.outputs.name).toBe("Alice");
    });

    it("POST / with input causing rejection returns 400", async () => {
        const app = buildTestApp(`
workflow:
    trigger: when a request is received
    reject with "Not allowed"
`);
        const res = await request(app).post("/").send({});
        expect(res.status).toBe(400);
        expect(res.body.status).toBe("rejected");
        expect(res.body.message).toBe("Not allowed");
    });

    it("POST / with empty body executes with empty input", async () => {
        const app = buildTestApp(`
workflow:
    complete with status "ok"
`);
        const res = await request(app).post("/").send({});
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("completed");
        expect(res.body.outputs.status).toBe("ok");
    });

    it("POST / returns JSON-serializable outputs", async () => {
        const app = buildTestApp(`
workflow:
    set count to 42
    complete with label "test" and count count
`);
        const res = await request(app).post("/").send({});
        expect(res.status).toBe(200);
        expect(res.body.outputs.label).toBe("test");
        expect(res.body.outputs.count).toBe(42);
    });
});

// ============================================================
// Multiple workflows (directory)
// ============================================================

describe("Server — Multiple workflows (directory)", () => {
    it("POST /email-verification triggers the correct workflow", async () => {
        const app = buildDirectoryApp();
        const res = await request(app)
            .post("/email-verification")
            .send({ signup: { email: "test@example.com" } });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("completed");
        expect(res.body.outputs.status).toBe("verified");
    });

    it("POST /order-processing triggers the correct workflow", async () => {
        const app = buildDirectoryApp();
        const res = await request(app)
            .post("/order-processing")
            .send({
                order: { id: "ORD-123", items: ["widget"], subtotal: 100 },
            });
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("completed");
        expect(res.body.outputs.status).toBe("processed");
    });

    it("POST /unknown returns 404 with available routes", async () => {
        const app = buildDirectoryApp();
        const res = await request(app).post("/unknown").send({});
        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Unknown workflow");
        expect(res.body.available).toBeInstanceOf(Array);
        expect(res.body.available).toContain("/email-verification");
    });

    it("GET /unknown returns 404 with available routes", async () => {
        const app = buildDirectoryApp();
        const res = await request(app).get("/unknown");
        expect(res.status).toBe(404);
        expect(res.body.available).toBeInstanceOf(Array);
    });
});

// ============================================================
// Error handling
// ============================================================

describe("Server — Error handling", () => {
    it("runtime error returns 500 with error message", async () => {
        const app = buildTestApp(`
workflow:
    trigger: when a request arrives
    set x to "hello" minus 1
    complete with status "ok"
`);
        const res = await request(app).post("/").send({});
        expect(res.status).toBe(500);
        expect(res.body.status).toBe("error");
        expect(res.body.message).toBeTruthy();
    });

    it("one failed request does not crash the server", async () => {
        const app = buildTestApp(`
workflow:
    trigger: when a request arrives
    if request.fail is "yes":
        reject with "failed on purpose"
    otherwise:
        complete with status "ok"
`);
        // First request: rejection
        const res1 = await request(app).post("/").send({ request: { fail: "yes" } });
        expect(res1.status).toBe(400);

        // Second request: success
        const res2 = await request(app).post("/").send({ request: { fail: "no" } });
        expect(res2.status).toBe(200);
        expect(res2.body.status).toBe("completed");
    });

    it("malformed .flow source throws during workflow loading", () => {
        expect(() => {
            buildWorkflow(`
config:
    name: "Bad"

workflow:
    if:
        complete with status "ok"
`);
        }).toThrow();
    });

    it("single-file 404 gives helpful hint", async () => {
        const app = buildTestApp(`
workflow:
    complete with status "ok"
`);
        const res = await request(app).get("/nonexistent");
        expect(res.status).toBe(404);
        expect(res.body.hint).toBe("POST to / to trigger the workflow");
    });
});

// ============================================================
// Configuration
// ============================================================

describe("Server — Configuration", () => {
    it("mock mode uses mock connectors", async () => {
        const app = buildTestApp(`
services:
    TestAPI is an API at "https://nonexistent.invalid/api"

workflow:
    trigger: when a test runs
    get data using TestAPI
    complete with status "ok"
`, { mock: true });
        const res = await request(app).post("/").send({});
        expect(res.status).toBe(200);
        expect(res.body.status).toBe("completed");
    });

    it("verbose mode does not affect response content", async () => {
        const appQuiet = buildTestApp(`
workflow:
    complete with status "ok"
`, { verbose: false });
        const appVerbose = buildTestApp(`
workflow:
    complete with status "ok"
`, { verbose: true });

        const res1 = await request(appQuiet).post("/").send({});
        const res2 = await request(appVerbose).post("/").send({});
        expect(res1.body).toEqual(res2.body);
    });

    it("loads multiple .flow files from examples directory", async () => {
        const app = buildDirectoryApp();
        const res = await request(app).get("/");
        expect(res.body.workflows.length).toBeGreaterThanOrEqual(3);
        for (const wf of res.body.workflows) {
            expect(wf.name).toBeTruthy();
            expect(wf.route).toMatch(/^\//);
        }
    });
});
