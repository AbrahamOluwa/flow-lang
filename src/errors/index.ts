import type { FlowError } from "../types/index.js";

/**
 * Compute the Levenshtein edit distance between two strings.
 * Used for "did you mean?" suggestions.
 */
export function levenshtein(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    const aLen = aLower.length;
    const bLen = bLower.length;

    // Previous and current row of distances
    let prev = Array.from({ length: bLen + 1 }, (_, i) => i);
    let curr = new Array<number>(bLen + 1);

    for (let i = 1; i <= aLen; i++) {
        curr[0] = i;
        for (let j = 1; j <= bLen; j++) {
            const cost = aLower[i - 1] === bLower[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                (prev[j] ?? 0) + 1,        // deletion
                (curr[j - 1] ?? 0) + 1,     // insertion
                (prev[j - 1] ?? 0) + cost   // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }

    return prev[bLen] ?? aLen;
}

/**
 * Find the closest match to `target` from a list of `candidates`.
 * Returns null if no candidate is close enough (threshold: 60% of target length, minimum 3).
 */
export function findClosestMatch(target: string, candidates: readonly string[]): string | null {
    if (candidates.length === 0) return null;

    const maxDistance = Math.max(3, Math.floor(target.length * 0.6));
    let bestMatch: string | null = null;
    let bestDistance = Infinity;

    for (const candidate of candidates) {
        const distance = levenshtein(target, candidate);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestMatch = candidate;
        }
    }

    if (bestDistance <= maxDistance && bestMatch !== null) {
        return bestMatch;
    }

    return null;
}

/**
 * Format a FlowError into the standard user-facing error message.
 *
 * Output format:
 *
 *     Error in <file>, line <n>:
 *
 *         <the offending source line>
 *
 *         <plain English explanation>
 *
 *         <suggestion>
 *
 *         <hint>
 */
export function formatError(error: FlowError): string {
    const label = error.severity === "warning" ? "Warning" : "Error";
    const lines: string[] = [];

    lines.push(`${label} in ${error.file}, line ${error.line}:`);
    lines.push("");

    if (error.sourceLine) {
        lines.push(`    ${error.sourceLine.trimEnd()}`);
        lines.push("");
    }

    lines.push(`    ${error.message}`);

    if (error.suggestion) {
        lines.push("");
        lines.push(`    ${error.suggestion}`);
    }

    if (error.hint) {
        lines.push("");
        for (const hintLine of error.hint.split("\n")) {
            lines.push(`    ${hintLine}`);
        }
    }

    return lines.join("\n");
}

/**
 * Format multiple errors into a single output string.
 */
export function formatErrors(errors: readonly FlowError[]): string {
    if (errors.length === 0) return "";
    return errors.map(formatError).join("\n\n");
}

/**
 * Create a FlowError with all required fields.
 */
export function createError(
    file: string,
    line: number,
    column: number,
    message: string,
    source: string,
    options?: { suggestion?: string; hint?: string; severity?: FlowError["severity"] }
): FlowError {
    const sourceLines = source.split("\n");
    const sourceLine = sourceLines[line - 1] ?? "";

    return {
        severity: options?.severity ?? "error",
        file,
        line,
        column,
        message,
        sourceLine,
        suggestion: options?.suggestion ?? null,
        hint: options?.hint ?? null,
    };
}
