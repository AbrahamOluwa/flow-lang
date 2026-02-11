import { tokenize } from "@flow/lexer/index.js";
import { parse } from "@flow/parser/index.js";
import { analyze } from "@flow/analyzer/index.js";
import {
    execute,
    createMockConnector,
    toDisplay,
    flowValueToJson,
} from "@flow/runtime/index.js";
import { formatErrors, formatError } from "@flow/errors/index.js";
import type { FlowError, LogEntry } from "@flow/types/index.js";
import type { ServiceConnector } from "@flow/runtime/index.js";

export interface RunResult {
    phase: "lexer" | "parser" | "analyzer" | "runtime";
    success: boolean;
    errors: FlowError[];
    output: string;
    logs: LogEntry[];
    status: "completed" | "rejected" | "error" | "parse-error";
    outputData?: Record<string, unknown>;
    rejectionMessage?: string;
}

export async function runFlow(source: string, inputJson: string): Promise<RunResult> {
    const fileName = "playground.flow";

    // Phase 1: Tokenize
    let tokens;
    try {
        tokens = tokenize(source, fileName);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            phase: "lexer",
            success: false,
            errors: [],
            output: message,
            logs: [],
            status: "error",
        };
    }

    // Phase 2: Parse
    const { program, errors: parseErrors } = parse(tokens, source, fileName);

    // Phase 3: Analyze
    const analysisErrors = analyze(program, source, fileName);
    const allErrors = [...parseErrors, ...analysisErrors];

    const hasErrors = allErrors.some(e => e.severity === "error");
    if (hasErrors) {
        return {
            phase: parseErrors.some(e => e.severity === "error") ? "parser" : "analyzer",
            success: false,
            errors: allErrors,
            output: formatErrors(allErrors),
            logs: [],
            status: "parse-error",
        };
    }

    // Phase 4: Parse input JSON
    let input: Record<string, unknown> = {};
    if (inputJson.trim()) {
        try {
            input = JSON.parse(inputJson) as Record<string, unknown>;
        } catch {
            return {
                phase: "runtime",
                success: false,
                errors: [],
                output: "Invalid JSON in the Input panel. Please check your JSON syntax.",
                logs: [],
                status: "error",
            };
        }
    }

    // Phase 5: Execute with mock connectors
    const connectors = new Map<string, ServiceConnector>();
    if (program.services) {
        for (const decl of program.services.declarations) {
            connectors.set(decl.name, createMockConnector(decl.serviceType));
        }
    }

    try {
        const result = await execute(program, source, {
            input,
            connectors,
            envVars: {},
            verbose: true,
        });

        const logs = result.log;
        const warnings = allErrors.filter(e => e.severity === "warning");

        if (result.result.status === "completed") {
            const outputs = result.result.outputs;
            const outputEntries = Object.entries(outputs);
            let output = "Workflow completed successfully.";
            if (outputEntries.length > 0) {
                output += "\n\nOutputs:\n";
                for (const [key, value] of outputEntries) {
                    output += `  ${key}: ${toDisplay(value)}\n`;
                }
            }
            return {
                phase: "runtime",
                success: true,
                errors: warnings,
                output,
                logs,
                status: "completed",
                outputData: Object.fromEntries(
                    outputEntries.map(([k, v]) => [k, flowValueToJson(v)]),
                ),
            };
        }

        if (result.result.status === "rejected") {
            return {
                phase: "runtime",
                success: true,
                errors: warnings,
                output: `Workflow rejected: ${result.result.message}`,
                logs,
                status: "rejected",
                rejectionMessage: result.result.message,
            };
        }

        // Runtime error
        return {
            phase: "runtime",
            success: false,
            errors: [result.result.error, ...warnings],
            output: formatError(result.result.error),
            logs,
            status: "error",
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            phase: "runtime",
            success: false,
            errors: [],
            output: `Runtime error: ${message}`,
            logs: [],
            status: "error",
        };
    }
}
