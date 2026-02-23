import { type ThreadBindingManager, type ThreadBindingRecord, type ThreadBindingTargetKind } from "./thread-bindings.types.js";
export declare const MANAGERS_BY_ACCOUNT_ID: Map<string, ThreadBindingManager>;
export declare const BINDINGS_BY_THREAD_ID: Map<string, ThreadBindingRecord>;
export declare const BINDINGS_BY_SESSION_KEY: Map<string, Set<string>>;
export declare const TOKENS_BY_ACCOUNT_ID: Map<string, string>;
export declare const RECENT_UNBOUND_WEBHOOK_ECHOES_BY_BINDING_KEY: Map<string, {
    webhookId: string;
    expiresAt: number;
}>;
export declare const REUSABLE_WEBHOOKS_BY_ACCOUNT_CHANNEL: Map<string, {
    webhookId: string;
    webhookToken: string;
}>;
export declare const PERSIST_BY_ACCOUNT_ID: Map<string, boolean>;
export declare function rememberThreadBindingToken(params: {
    accountId?: string;
    token?: string;
}): void;
export declare function forgetThreadBindingToken(accountId?: string): void;
export declare function getThreadBindingToken(accountId?: string): string | undefined;
export declare function shouldDefaultPersist(): boolean;
export declare function resolveThreadBindingsPath(): string;
export declare function normalizeTargetKind(raw: unknown, targetSessionKey: string): ThreadBindingTargetKind;
export declare function normalizeThreadId(raw: unknown): string | undefined;
export declare function toBindingRecordKey(params: {
    accountId: string;
    threadId: string;
}): string;
export declare function resolveBindingRecordKey(params: {
    accountId?: string;
    threadId: string;
}): string | undefined;
export declare function normalizeThreadBindingTtlMs(raw: unknown): number;
export declare function resolveThreadBindingExpiresAt(params: {
    record: Pick<ThreadBindingRecord, "boundAt" | "expiresAt">;
    sessionTtlMs: number;
}): number | undefined;
export declare function toReusableWebhookKey(params: {
    accountId: string;
    channelId: string;
}): string;
export declare function rememberReusableWebhook(record: ThreadBindingRecord): void;
export declare function rememberRecentUnboundWebhookEcho(record: ThreadBindingRecord): void;
export declare function setBindingRecord(record: ThreadBindingRecord): void;
export declare function removeBindingRecord(bindingKeyRaw: string): ThreadBindingRecord | null;
export declare function isRecentlyUnboundThreadWebhookMessage(params: {
    accountId?: string;
    threadId: string;
    webhookId?: string | null;
}): boolean;
export declare function shouldPersistBindingMutations(): boolean;
export declare function saveBindingsToDisk(params?: {
    force?: boolean;
}): void;
export declare function ensureBindingsLoaded(): void;
export declare function resolveBindingIdsForSession(params: {
    targetSessionKey: string;
    accountId?: string;
    targetKind?: ThreadBindingTargetKind;
}): string[];
export declare function resetThreadBindingsForTests(): void;
