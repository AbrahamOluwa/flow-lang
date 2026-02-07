#!/usr/bin/env node

import { readFileSync } from "fs";
import { config as loadDotenv } from "dotenv";
import { Command } from "commander";
import chalk from "chalk";
import { tokenize } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import { analyze } from "../analyzer/index.js";
import {
    execute, toDisplay, flowValueToJson,
    HTTPAPIConnector, WebhookConnector, PluginStubConnector,
    createMockConnector,
} from "../runtime/index.js";
import { formatErrors } from "../errors/index.js";
import type { FlowError, LogEntry, ServiceDeclaration } from "../types/index.js";
import type { ServiceConnector } from "../runtime/index.js";

// ============================================================
// Pipeline helpers
// ============================================================

interface PipelineResult {
    success: boolean;
    errors: FlowError[];
    program?: ReturnType<typeof parse>["program"];
    source?: string;
}

function runPipeline(filePath: string): PipelineResult {
    let source: string;
    try {
        source = readFileSync(filePath, "utf-8");
    } catch {
        console.error(chalk.red(`Error: Could not read file "${filePath}"`));
        return { success: false, errors: [] };
    }

    // Tokenize
    let tokens;
    try {
        tokens = tokenize(source, filePath);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Lexer error: ${message}`));
        return { success: false, errors: [] };
    }

    // Parse
    const { program, errors: parseErrors } = parse(tokens, source, filePath);

    // Analyze
    const analysisErrors = analyze(program, source, filePath);

    const allErrors = [...parseErrors, ...analysisErrors];
    if (allErrors.length > 0) {
        return { success: false, errors: allErrors, program, source };
    }

    return { success: true, errors: [], program, source };
}

// ============================================================
// Output helpers
// ============================================================

function printErrors(errors: FlowError[]): void {
    console.error(formatErrors(errors));
    const errorCount = errors.filter(e => e.severity === "error").length;
    const warnCount = errors.filter(e => e.severity === "warning").length;
    const parts: string[] = [];
    if (errorCount > 0) parts.push(chalk.red(`${errorCount} error${errorCount !== 1 ? "s" : ""}`));
    if (warnCount > 0) parts.push(chalk.yellow(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`));
    console.error("\n" + parts.join(", ") + " found.");
}

function printLog(log: LogEntry[], verbose: boolean): void {
    if (!verbose) return;
    if (log.length === 0) return;

    console.log(chalk.gray("\n--- Execution Log ---"));
    for (const entry of log) {
        const stepLabel = entry.step ? chalk.cyan(`[${entry.step}]`) + " " : "";
        const resultColor = entry.result === "success" ? chalk.green : entry.result === "failure" ? chalk.red : chalk.yellow;
        const resultLabel = resultColor(entry.result);

        let detail = "";
        if (entry.details["message"]) {
            detail = ` ${entry.details["message"]}`;
        }

        console.log(chalk.gray(`  ${stepLabel}${entry.action} ${resultLabel}${detail}`));
    }
    console.log(chalk.gray("--- End Log ---"));
}

function buildConnectors(declarations: ServiceDeclaration[]): Map<string, ServiceConnector> {
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
                // AI connectors will use mocks until Phase 9
                connectors.set(decl.name, createMockConnector("ai"));
                break;
        }
    }
    return connectors;
}

// ============================================================
// Commands
// ============================================================

function checkCommand(filePath: string): void {
    const { success, errors } = runPipeline(filePath);

    if (!success && errors.length === 0) {
        process.exitCode = 1;
        return;
    }

    if (errors.length > 0) {
        printErrors(errors);
        process.exitCode = 1;
        return;
    }

    console.log(chalk.green(`No errors found in ${filePath}`));
}

async function runCommand(filePath: string, options: { input?: string; verbose?: boolean; strictEnv?: boolean; mock?: boolean }): Promise<void> {
    // Load .env file into process.env
    loadDotenv();

    const pipeline = runPipeline(filePath);

    if (!pipeline.success) {
        if (pipeline.errors.length > 0) printErrors(pipeline.errors);
        process.exitCode = 1;
        return;
    }

    // Parse input
    let input: Record<string, unknown> = {};
    if (options.input) {
        try {
            input = JSON.parse(options.input) as Record<string, unknown>;
        } catch {
            console.error(chalk.red(`Error: Invalid JSON input: ${options.input}`));
            process.exitCode = 1;
            return;
        }
    }

    // Build connectors: real by default, mock with --mock flag
    let connectors: Map<string, ServiceConnector> | undefined;
    if (!options.mock && pipeline.program!.services) {
        connectors = buildConnectors(pipeline.program!.services.declarations);
    }

    // Execute
    const result = await execute(pipeline.program!, pipeline.source!, {
        input,
        connectors,
        envVars: process.env as Record<string, string>,
        verbose: options.verbose,
        strictEnv: options.strictEnv,
    });

    // Print log
    printLog(result.log, options.verbose ?? false);

    // Print result
    switch (result.result.status) {
        case "completed": {
            console.log(chalk.green("\nWorkflow completed successfully."));
            const keys = Object.keys(result.result.outputs);
            if (keys.length > 0) {
                console.log(chalk.white("\nOutputs:"));
                for (const [key, value] of Object.entries(result.result.outputs)) {
                    console.log(`  ${chalk.cyan(key)}: ${toDisplay(value)}`);
                }
            }
            break;
        }
        case "rejected":
            console.log(chalk.red(`\nWorkflow rejected: ${result.result.message}`));
            process.exitCode = 1;
            break;
        case "error":
            console.error(chalk.red(`\nRuntime error:`));
            console.error(formatErrors([result.result.error]));
            process.exitCode = 1;
            break;
    }
}

async function testCommand(filePath: string, options: { verbose?: boolean }): Promise<void> {
    const pipeline = runPipeline(filePath);

    if (!pipeline.success) {
        if (pipeline.errors.length > 0) printErrors(pipeline.errors);
        process.exitCode = 1;
        return;
    }

    console.log(chalk.blue(`Testing ${filePath} with mock services...\n`));

    const result = await execute(pipeline.program!, pipeline.source!, {
        input: {},
        envVars: { API_KEY: "mock-api-key", SECRET: "mock-secret" },
        verbose: options.verbose,
    });

    printLog(result.log, options.verbose ?? false);

    switch (result.result.status) {
        case "completed": {
            console.log(chalk.green("\nTest passed — workflow completed successfully."));
            const keys = Object.keys(result.result.outputs);
            if (keys.length > 0) {
                console.log(chalk.white("\nOutputs:"));
                for (const [key, value] of Object.entries(result.result.outputs)) {
                    console.log(`  ${chalk.cyan(key)}: ${JSON.stringify(flowValueToJson(value))}`);
                }
            }
            break;
        }
        case "rejected":
            console.log(chalk.yellow(`\nTest result — workflow rejected: ${result.result.message}`));
            break;
        case "error":
            console.log(chalk.red(`\nTest failed — runtime error:`));
            console.error(formatErrors([result.result.error]));
            process.exitCode = 1;
            break;
    }
}

// ============================================================
// CLI setup
// ============================================================

const program = new Command();

program
    .name("flow")
    .description("Flow — a language for AI agent and workflow orchestration")
    .version("0.1.0");

program
    .command("check <file>")
    .description("Check a .flow file for errors without running it")
    .action(checkCommand);

program
    .command("run <file>")
    .description("Execute a .flow file")
    .option("--input <json>", "JSON string with input data for the workflow")
    .option("--verbose", "Show detailed execution log")
    .option("--strict-env", "Error on missing environment variables instead of using empty")
    .option("--mock", "Use mock services instead of real HTTP calls")
    .action(runCommand);

program
    .command("test <file>")
    .description("Test a .flow file with mock services")
    .option("--dry-run", "Use mock services (default)")
    .option("--verbose", "Show detailed execution log")
    .action(testCommand);

program.parse();
