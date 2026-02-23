"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeGetCwd = safeGetCwd;
exports.isBrowserEnvironment = isBrowserEnvironment;
exports.consoleSupportsCssStyling = consoleSupportsCssStyling;
function safeGetCwd() {
    try {
        const nodeProcess = globalThis?.process;
        if (typeof nodeProcess?.cwd === "function") {
            return nodeProcess.cwd();
        }
    }
    catch {
    }
    try {
        const deno = globalThis?.["Deno"];
        if (typeof deno?.cwd === "function") {
            return deno.cwd();
        }
    }
    catch {
    }
    return undefined;
}
function isBrowserEnvironment() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}
function consoleSupportsCssStyling() {
    if (!isBrowserEnvironment()) {
        return false;
    }
    const navigatorObj = globalThis?.navigator;
    const userAgent = navigatorObj?.userAgent ?? "";
    if (/firefox/i.test(userAgent)) {
        return true;
    }
    const windowObj = globalThis;
    if (windowObj?.CSS?.supports?.("color", "#000")) {
        return true;
    }
    return /safari/i.test(userAgent) && !/chrome/i.test(userAgent);
}
