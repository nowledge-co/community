import type { ThreadBindingRecord, ThreadBindingTargetKind } from "./thread-bindings.types.js";
export declare function listThreadBindingsForAccount(accountId?: string): ThreadBindingRecord[];
export declare function listThreadBindingsBySessionKey(params: {
    targetSessionKey: string;
    accountId?: string;
    targetKind?: ThreadBindingTargetKind;
}): ThreadBindingRecord[];
export declare function autoBindSpawnedDiscordSubagent(params: {
    accountId?: string;
    channel?: string;
    to?: string;
    threadId?: string | number;
    childSessionKey: string;
    agentId: string;
    label?: string;
    boundBy?: string;
}): Promise<ThreadBindingRecord | null>;
export declare function unbindThreadBindingsBySessionKey(params: {
    targetSessionKey: string;
    accountId?: string;
    targetKind?: ThreadBindingTargetKind;
    reason?: string;
    sendFarewell?: boolean;
    farewellText?: string;
}): ThreadBindingRecord[];
export declare function setThreadBindingTtlBySessionKey(params: {
    targetSessionKey: string;
    accountId?: string;
    ttlMs: number;
}): ThreadBindingRecord[];
