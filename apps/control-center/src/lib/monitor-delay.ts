export const DEFAULT_QUERY_DELAY_MS = 1500;
export const MIN_QUERY_DELAY_MS = 500;
export const MAX_QUERY_DELAY_MS = 60000;

export function normalizeQueryDelayMs(value: unknown): number {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return DEFAULT_QUERY_DELAY_MS;

    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
        throw new Error("Query delay must be a whole number of milliseconds");
    }

    if (parsed < MIN_QUERY_DELAY_MS || parsed > MAX_QUERY_DELAY_MS) {
        throw new Error(
            `Query delay must be between ${MIN_QUERY_DELAY_MS} and ${MAX_QUERY_DELAY_MS} ms`,
        );
    }

    return parsed;
}

export function formatQueryDelay(ms: number): string {
    if (ms >= 1000) {
        const seconds = ms / 1000;
        return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
    }

    return `${ms}ms`;
}
