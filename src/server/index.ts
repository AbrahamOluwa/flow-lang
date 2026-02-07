import express from "express";
import type { Request, Response } from "express";
import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, basename } from "path";
import { config as loadDotenv } from "dotenv";
import chalk from "chalk";
import { tokenize } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import { analyze } from "../analyzer/index.js";
import { execute, flowValueToJson, buildConnectors } from "../runtime/index.js";
import { formatErrors } from "../errors/index.js";
import type { Program, FlowError } from "../types/index.js";
import type { ServiceConnector } from "../runtime/index.js";

// ============================================================
// Types
// ============================================================

export interface LoadedWorkflow {
    name: string;
    version: string | number | null;
    trigger: string | null;
    filePath: string;
    program: Program;
    source: string;
}

export interface ServeOptions {
    port: number;
    verbose: boolean;
    mock: boolean;
}

// ============================================================
// Workflow loading
// ============================================================

class ServerStartupError extends Error {
    constructor(public filePath: string, public errors: FlowError[]) {
        super(`Validation errors in ${filePath}`);
        this.name = "ServerStartupError";
    }
}

export function loadWorkflow(filePath: string): LoadedWorkflow {
    const source = readFileSync(filePath, "utf-8");
    const tokens = tokenize(source, filePath);
    const { program, errors: parseErrors } = parse(tokens, source, filePath);
    const analysisErrors = analyze(program, source, filePath);
    const allErrors = [...parseErrors, ...analysisErrors];

    if (allErrors.length > 0) {
        throw new ServerStartupError(filePath, allErrors);
    }

    const nameEntry = program.config?.entries.find(e => e.key === "name");
    const name = nameEntry ? String(nameEntry.value) : basename(filePath, ".flow");
    const versionEntry = program.config?.entries.find(e => e.key === "version");
    const version = versionEntry?.value ?? null;
    const trigger = program.workflow?.trigger?.description ?? null;

    return { name, version, trigger, filePath, program, source };
}

export function loadWorkflows(target: string): Map<string, LoadedWorkflow> {
    const fullPath = resolve(target);
    const stat = statSync(fullPath);
    const workflows = new Map<string, LoadedWorkflow>();

    if (stat.isFile()) {
        workflows.set("", loadWorkflow(fullPath));
    } else if (stat.isDirectory()) {
        const files = readdirSync(fullPath)
            .filter(f => f.endsWith(".flow"))
            .sort();
        if (files.length === 0) {
            throw new Error(`No .flow files found in "${target}"`);
        }
        for (const file of files) {
            const route = basename(file, ".flow");
            workflows.set(route, loadWorkflow(resolve(fullPath, file)));
        }
    } else {
        throw new Error(`"${target}" is not a file or directory`);
    }

    return workflows;
}

// ============================================================
// Request handling
// ============================================================

function createWorkflowHandler(
    workflow: LoadedWorkflow,
    options: ServeOptions,
): (req: Request, res: Response) => void {
    return async (req: Request, res: Response) => {
        const input = (req.body ?? {}) as Record<string, unknown>;

        let connectors: Map<string, ServiceConnector> | undefined;
        if (!options.mock && workflow.program.services) {
            connectors = buildConnectors(workflow.program.services.declarations);
        }

        try {
            const result = await execute(workflow.program, workflow.source, {
                input,
                connectors,
                envVars: process.env as Record<string, string>,
                verbose: options.verbose,
            });

            if (options.verbose) {
                logRequest(req, result.result.status);
            }

            switch (result.result.status) {
                case "completed": {
                    const outputs: Record<string, unknown> = {};
                    for (const [key, value] of Object.entries(result.result.outputs)) {
                        outputs[key] = flowValueToJson(value);
                    }
                    res.status(200).json({ status: "completed", outputs });
                    break;
                }
                case "rejected":
                    res.status(400).json({
                        status: "rejected",
                        message: result.result.message,
                    });
                    break;
                case "error":
                    res.status(500).json({
                        status: "error",
                        message: result.result.error.message,
                    });
                    break;
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (options.verbose) {
                logRequest(req, "error");
            }
            res.status(500).json({
                status: "error",
                message: `Internal error: ${message}`,
            });
        }
    };
}

function logRequest(req: Request, status: string): void {
    const timestamp = new Date().toISOString();
    console.log(chalk.gray(`[${timestamp}] ${req.method} ${req.path} -> ${status}`));
}

// ============================================================
// App factory
// ============================================================

export function createApp(
    workflows: Map<string, LoadedWorkflow>,
    options: ServeOptions,
): express.Application {
    const app = express();
    app.use(express.json());

    // Health check
    app.get("/health", (_req: Request, res: Response) => {
        res.json({ status: "ok" });
    });

    const isSingleFile = workflows.size === 1 && workflows.has("");

    if (isSingleFile) {
        const workflow = workflows.get("")!;

        // GET / — workflow metadata
        app.get("/", (_req: Request, res: Response) => {
            res.json({
                name: workflow.name,
                version: workflow.version,
                trigger: workflow.trigger,
            });
        });

        // POST / — execute workflow
        app.post("/", createWorkflowHandler(workflow, options));
    } else {
        // GET / — list all workflows
        app.get("/", (_req: Request, res: Response) => {
            const list = Array.from(workflows.entries()).map(([route, wf]) => ({
                route: `/${route}`,
                name: wf.name,
                version: wf.version,
                trigger: wf.trigger,
            }));
            res.json({ workflows: list });
        });

        // POST /:workflow — execute specific workflow
        for (const [route, workflow] of workflows) {
            app.post(`/${route}`, createWorkflowHandler(workflow, options));
        }
    }

    // 404 handler
    app.use((_req: Request, res: Response) => {
        if (isSingleFile) {
            res.status(404).json({
                error: "Not found",
                hint: "POST to / to trigger the workflow",
            });
        } else {
            const routes = Array.from(workflows.keys()).map(r => `/${r}`);
            res.status(404).json({
                error: "Unknown workflow",
                available: routes,
            });
        }
    });

    return app;
}

// ============================================================
// Server startup
// ============================================================

export function startServer(target: string, options: ServeOptions): void {
    loadDotenv();

    let workflows: Map<string, LoadedWorkflow>;
    try {
        workflows = loadWorkflows(target);
    } catch (err) {
        if (err instanceof ServerStartupError) {
            console.error(chalk.red(`\nErrors in ${err.filePath}:\n`));
            console.error(formatErrors(err.errors));
            process.exitCode = 1;
            return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Error: ${message}`));
        process.exitCode = 1;
        return;
    }

    const app = createApp(workflows, options);

    const server = app.listen(options.port, () => {
        console.log(chalk.green(`\nFlow server running on port ${options.port}`));
        console.log(chalk.white("\nLoaded workflows:"));
        for (const [route, wf] of workflows) {
            const path = route === "" ? "/" : `/${route}`;
            console.log(`  ${chalk.cyan(path)} -> ${wf.name}`);
        }
        console.log(chalk.gray(`\nHealth check: GET http://localhost:${options.port}/health`));
    });

    const shutdown = (): void => {
        console.log(chalk.yellow("\nShutting down..."));
        server.close(() => {
            console.log(chalk.gray("Server stopped."));
            process.exit(0);
        });
        setTimeout(() => {
            console.error(chalk.red("Forced shutdown after timeout."));
            process.exit(1);
        }, 5000);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
