import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, basename } from "path";
import { config as loadDotenv } from "dotenv";
import chalk from "chalk";
import { tokenize } from "../lexer/index.js";
import { parse } from "../parser/index.js";
import { analyze } from "../analyzer/index.js";
import { execute, flowValueToJson, buildConnectors, toDisplay } from "../runtime/index.js";
import { formatErrors } from "../errors/index.js";
import { parseInputFile } from "../cli/input-file.js";
import type { FlowError, LogEntry, StructuredLog, SerializedLogEntry } from "../types/index.js";
import type { ServiceConnector } from "../runtime/index.js";

// ============================================================
// Schedule expression parsing
// ============================================================

const DAY_MAP: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
};

export function parseEveryExpression(description: string): string {
    const input = description.trim().toLowerCase();

    // "N minutes" → */N * * * *
    const minutesMatch = input.match(/^(\d+)\s+minutes?$/);
    if (minutesMatch) {
        const n = parseInt(minutesMatch[1]!, 10);
        if (n < 1 || n > 59) {
            throw new Error(`Invalid minute interval: ${n}. Must be between 1 and 59.`);
        }
        return `*/${n} * * * *`;
    }

    // "N hours" → 0 */N * * *
    const hoursMatch = input.match(/^(\d+)\s+hours?$/);
    if (hoursMatch) {
        const n = parseInt(hoursMatch[1]!, 10);
        if (n < 1 || n > 23) {
            throw new Error(`Invalid hour interval: ${n}. Must be between 1 and 23.`);
        }
        return `0 */${n} * * *`;
    }

    // "hour" → 0 * * * *
    if (input === "hour") {
        return "0 * * * *";
    }

    // "day at HH:MM" → MM HH * * *
    const dayAtMatch = input.match(/^day\s+at\s+(\d{1,2}):(\d{2})$/);
    if (dayAtMatch) {
        const hour = parseInt(dayAtMatch[1]!, 10);
        const minute = parseInt(dayAtMatch[2]!, 10);
        return `${minute} ${hour} * * *`;
    }

    // "day" → 0 0 * * *
    if (input === "day") {
        return "0 0 * * *";
    }

    // "<weekday> at HH:MM" → MM HH * * DOW
    const weekdayAtMatch = input.match(/^([a-z]+)\s+at\s+(\d{1,2}):(\d{2})$/);
    if (weekdayAtMatch) {
        const dayNum = DAY_MAP[weekdayAtMatch[1]!];
        if (dayNum === undefined) {
            throw new Error(
                `Unknown day "${weekdayAtMatch[1]}". ` +
                "Valid days: monday, tuesday, wednesday, thursday, friday, saturday, sunday (or mon, tue, wed, thu, fri, sat, sun)."
            );
        }
        const hour = parseInt(weekdayAtMatch[2]!, 10);
        const minute = parseInt(weekdayAtMatch[3]!, 10);
        return `${minute} ${hour} * * ${dayNum}`;
    }

    // "<weekday>" alone → 0 0 * * DOW
    const dayNum = DAY_MAP[input];
    if (dayNum !== undefined) {
        return `0 0 * * ${dayNum}`;
    }

    throw new Error(
        `Could not parse schedule: "${description.trim()}"\n\n` +
        "Valid formats:\n" +
        '  --every "5 minutes"\n' +
        '  --every "2 hours"\n' +
        '  --every "hour"\n' +
        '  --every "day"\n' +
        '  --every "day at 9:00"\n' +
        '  --every "monday at 9:00"\n' +
        '  --every "friday"'
    );
}

// ============================================================
// Schedule options
// ============================================================

export interface ScheduleOptions {
    cron?: string;
    every?: string;
    input?: string;
    inputFile?: string;
    verbose?: boolean;
    mock?: boolean;
    outputLog?: string;
}

// ============================================================
// Log serializer (shared with CLI)
// ============================================================

function serializeLogEntries(entries: LogEntry[]): SerializedLogEntry[] {
    return entries.map(e => ({
        timestamp: e.timestamp.toISOString(),
        step: e.step,
        action: e.action,
        result: e.result,
        durationMs: e.durationMs,
        details: e.details,
    }));
}

// ============================================================
// Schedule runner
// ============================================================

export async function startSchedule(filePath: string, options: ScheduleOptions): Promise<void> {
    loadDotenv({ quiet: true });

    // Determine cron expression
    let cronExpression: string;
    if (options.cron) {
        cronExpression = options.cron;
    } else if (options.every) {
        cronExpression = parseEveryExpression(options.every);
    } else {
        console.error(chalk.red('Error: Provide either --cron "<expression>" or --every "<description>".'));
        process.exitCode = 1;
        return;
    }

    // Validate .flow file at startup
    let source: string;
    try {
        source = readFileSync(filePath, "utf-8");
    } catch {
        console.error(chalk.red(`Error: Could not read file "${filePath}"`));
        process.exitCode = 1;
        return;
    }

    let tokens;
    try {
        tokens = tokenize(source, filePath);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`Lexer error: ${message}`));
        process.exitCode = 1;
        return;
    }

    const { program, errors: parseErrors } = parse(tokens, source, filePath);
    const analysisErrors = analyze(program, source, filePath);
    const allErrors: FlowError[] = [...parseErrors, ...analysisErrors];

    if (allErrors.length > 0) {
        console.error(formatErrors(allErrors));
        const errorCount = allErrors.filter(e => e.severity === "error").length;
        const warnCount = allErrors.filter(e => e.severity === "warning").length;
        const parts: string[] = [];
        if (errorCount > 0) parts.push(chalk.red(`${errorCount} error${errorCount !== 1 ? "s" : ""}`));
        if (warnCount > 0) parts.push(chalk.yellow(`${warnCount} warning${warnCount !== 1 ? "s" : ""}`));
        console.error("\n" + parts.join(", ") + " found.");
        process.exitCode = 1;
        return;
    }

    // Parse input
    let input: Record<string, unknown> = {};
    if (options.input && options.inputFile) {
        console.error(chalk.red("Error: Use either --input or --input-file, not both."));
        process.exitCode = 1;
        return;
    }
    if (options.input) {
        try {
            input = JSON.parse(options.input) as Record<string, unknown>;
        } catch {
            console.error(chalk.red(`Error: Invalid JSON input: ${options.input}`));
            process.exitCode = 1;
            return;
        }
    }
    if (options.inputFile) {
        try {
            input = parseInputFile(options.inputFile);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(chalk.red(`Error reading input file: ${message}`));
            process.exitCode = 1;
            return;
        }
    }

    // Dynamic import of node-cron
    let cron: { validate: (expr: string) => boolean; schedule: (expr: string, fn: () => void) => { stop: () => void } };
    try {
        const mod = await import("node-cron");
        cron = mod.default as typeof cron;
    } catch {
        console.error(chalk.red(
            'The "node-cron" package is required for scheduling. ' +
            "Install it with: npm install node-cron"
        ));
        process.exitCode = 1;
        return;
    }

    // Validate cron expression
    if (!cron.validate(cronExpression)) {
        console.error(chalk.red(`Error: Invalid cron expression: "${cronExpression}"`));
        console.error(chalk.gray('Expected format: "* * * * *" (minute hour day month weekday)'));
        process.exitCode = 1;
        return;
    }

    // Prepare output-log directory if needed
    if (options.outputLog) {
        if (!existsSync(options.outputLog)) {
            mkdirSync(options.outputLog, { recursive: true });
        }
    }

    const configEntries = program.config?.entries;
    const nameEntry = configEntries?.find(e => e.key === "name")?.value;
    const workflowName = nameEntry ? String(nameEntry) : basename(filePath);
    const versionEntry = configEntries?.find(e => e.key === "version")?.value;
    const version = versionEntry ? parseInt(String(versionEntry), 10) : null;

    console.log(chalk.green(`\nScheduler started for ${workflowName}`));
    console.log(chalk.white(`  Schedule: ${cronExpression}`));
    if (options.every) {
        console.log(chalk.gray(`  (every ${options.every})`));
    }
    console.log(chalk.gray("  Press Ctrl+C to stop.\n"));

    let executionCount = 0;

    const task = cron.schedule(cronExpression, async () => {
        executionCount++;
        const runId = executionCount;
        const timestamp = new Date().toISOString();
        console.log(chalk.cyan(`[${timestamp}] Run #${runId} starting...`));

        // Build connectors
        let connectors: Map<string, ServiceConnector> | undefined;
        if (!options.mock && program.services) {
            connectors = buildConnectors(program.services.declarations);
        }

        const startedAt = new Date();
        const startTime = performance.now();

        try {
            const result = await execute(program, source, {
                input,
                connectors,
                envVars: process.env as Record<string, string>,
                verbose: options.verbose,
            });
            const totalMs = Math.round(performance.now() - startTime);
            const completedAt = new Date();

            switch (result.result.status) {
                case "completed": {
                    console.log(chalk.green(`  Run #${runId} completed (${totalMs}ms)`));
                    const keys = Object.keys(result.result.outputs);
                    if (keys.length > 0 && options.verbose) {
                        for (const [key, value] of Object.entries(result.result.outputs)) {
                            console.log(`    ${chalk.cyan(key)}: ${toDisplay(value)}`);
                        }
                    }
                    break;
                }
                case "rejected":
                    console.log(chalk.yellow(`  Run #${runId} rejected: ${result.result.message} (${totalMs}ms)`));
                    break;
                case "error":
                    console.log(chalk.red(`  Run #${runId} error: ${result.result.error.message} (${totalMs}ms)`));
                    break;
            }

            // Write log file if output-log directory specified
            if (options.outputLog) {
                let outputs: Record<string, unknown> | null = null;
                let error: string | null = null;
                if (result.result.status === "completed") {
                    outputs = {};
                    for (const [k, v] of Object.entries(result.result.outputs)) {
                        outputs[k] = flowValueToJson(v);
                    }
                } else if (result.result.status === "rejected") {
                    error = result.result.message;
                } else {
                    error = result.result.error.message;
                }

                const structuredLog: StructuredLog = {
                    workflow: workflowName,
                    version: Number.isNaN(version) ? null : version,
                    status: result.result.status,
                    startedAt: startedAt.toISOString(),
                    completedAt: completedAt.toISOString(),
                    durationMs: totalMs,
                    outputs,
                    error,
                    entries: serializeLogEntries(result.log),
                };

                const logFileName = `${startedAt.toISOString().replace(/[:.]/g, "-")}.json`;
                const logPath = resolve(options.outputLog, logFileName);
                try {
                    writeFileSync(logPath, JSON.stringify(structuredLog, null, 2), "utf-8");
                    if (options.verbose) {
                        console.log(chalk.gray(`    Log written to ${logPath}`));
                    }
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error(chalk.yellow(`  Warning: Could not write log file: ${message}`));
                }
            }
        } catch (err) {
            const totalMs = Math.round(performance.now() - startTime);
            const message = err instanceof Error ? err.message : String(err);
            console.error(chalk.red(`  Run #${runId} crashed: ${message} (${totalMs}ms)`));
        }
    });

    // Graceful shutdown
    const shutdown = (): void => {
        console.log(chalk.yellow("\nStopping scheduler..."));
        task.stop();
        console.log(chalk.gray(`Completed ${executionCount} run${executionCount !== 1 ? "s" : ""}.`));
        process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
}
