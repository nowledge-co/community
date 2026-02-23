import type { ChannelStatusIssue } from "../channels/plugins/types.js";
export declare function createDefaultChannelRuntimeState<T extends Record<string, unknown>>(accountId: string, extra?: T): {
    accountId: string;
    running: false;
    lastStartAt: null;
    lastStopAt: null;
    lastError: null;
} & T;
export declare function buildBaseChannelStatusSummary(snapshot: {
    configured?: boolean | null;
    running?: boolean | null;
    lastStartAt?: number | null;
    lastStopAt?: number | null;
    lastError?: string | null;
}): {
    configured: boolean;
    running: boolean;
    lastStartAt: number | null;
    lastStopAt: number | null;
    lastError: string | null;
};
export declare function collectStatusIssuesFromLastError(channel: string, accounts: Array<{
    accountId: string;
    lastError?: unknown;
}>): ChannelStatusIssue[];
