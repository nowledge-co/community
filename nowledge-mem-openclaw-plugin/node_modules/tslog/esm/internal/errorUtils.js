import { buildStackTrace } from "./stackTrace.js";
const DEFAULT_CAUSE_DEPTH = 5;
export function collectErrorCauses(error, options = {}) {
    const maxDepth = options.maxDepth ?? DEFAULT_CAUSE_DEPTH;
    const causes = [];
    const visited = new Set();
    let current = error;
    let depth = 0;
    while (current != null && depth < maxDepth) {
        const cause = current?.cause;
        if (cause == null || visited.has(cause)) {
            break;
        }
        visited.add(cause);
        causes.push(toError(cause));
        current = cause;
        depth += 1;
    }
    return causes;
}
export function toError(value) {
    if (value instanceof Error) {
        return value;
    }
    const error = new Error(typeof value === "string" ? value : JSON.stringify(value));
    if (typeof value === "object" && value != null) {
        Object.assign(error, value);
    }
    return error;
}
export function toErrorObject(error, parseLine) {
    return {
        nativeError: error,
        name: error.name ?? "Error",
        message: error.message ?? "",
        stack: buildStackTrace(error, parseLine),
    };
}
