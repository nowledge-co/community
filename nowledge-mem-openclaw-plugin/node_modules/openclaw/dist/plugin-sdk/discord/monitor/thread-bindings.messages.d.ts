import { type ThreadBindingRecord } from "./thread-bindings.types.js";
export declare function formatThreadBindingTtlLabel(ttlMs: number): string;
export declare function resolveThreadBindingThreadName(params: {
    agentId?: string;
    label?: string;
}): string;
export declare function resolveThreadBindingIntroText(params: {
    agentId?: string;
    label?: string;
    sessionTtlMs?: number;
}): string;
export declare function resolveThreadBindingFarewellText(params: {
    reason?: string;
    farewellText?: string;
    sessionTtlMs: number;
}): string;
export declare function summarizeBindingPersona(record: ThreadBindingRecord): string;
