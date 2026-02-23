export type BindingTargetKind = "subagent" | "session";
export type BindingStatus = "active" | "ending" | "ended";
export type ConversationRef = {
    channel: string;
    accountId: string;
    conversationId: string;
    parentConversationId?: string;
};
export type SessionBindingRecord = {
    bindingId: string;
    targetSessionKey: string;
    targetKind: BindingTargetKind;
    conversation: ConversationRef;
    status: BindingStatus;
    boundAt: number;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
};
type SessionBindingBindInput = {
    targetSessionKey: string;
    targetKind: BindingTargetKind;
    conversation: ConversationRef;
    metadata?: Record<string, unknown>;
    ttlMs?: number;
};
type SessionBindingUnbindInput = {
    bindingId?: string;
    targetSessionKey?: string;
    reason: string;
};
export type SessionBindingService = {
    bind: (input: SessionBindingBindInput) => Promise<SessionBindingRecord>;
    listBySession: (targetSessionKey: string) => SessionBindingRecord[];
    resolveByConversation: (ref: ConversationRef) => SessionBindingRecord | null;
    touch: (bindingId: string, at?: number) => void;
    unbind: (input: SessionBindingUnbindInput) => Promise<SessionBindingRecord[]>;
};
export type SessionBindingAdapter = {
    channel: string;
    accountId: string;
    bind?: (input: SessionBindingBindInput) => Promise<SessionBindingRecord | null>;
    listBySession: (targetSessionKey: string) => SessionBindingRecord[];
    resolveByConversation: (ref: ConversationRef) => SessionBindingRecord | null;
    touch?: (bindingId: string, at?: number) => void;
    unbind?: (input: SessionBindingUnbindInput) => Promise<SessionBindingRecord[]>;
};
export declare function registerSessionBindingAdapter(adapter: SessionBindingAdapter): void;
export declare function unregisterSessionBindingAdapter(params: {
    channel: string;
    accountId: string;
}): void;
export declare function getSessionBindingService(): SessionBindingService;
export declare const __testing: {
    resetSessionBindingAdaptersForTests(): void;
    getRegisteredAdapterKeys(): string[];
};
export {};
