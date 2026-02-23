"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonStringifyRecursive = jsonStringifyRecursive;
function jsonStringifyRecursive(obj) {
    const cache = new Set();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
            if (cache.has(value)) {
                return "[Circular]";
            }
            cache.add(value);
        }
        if (typeof value === "bigint") {
            return `${value}`;
        }
        if (typeof value === "undefined") {
            return "[undefined]";
        }
        return value;
    });
}
