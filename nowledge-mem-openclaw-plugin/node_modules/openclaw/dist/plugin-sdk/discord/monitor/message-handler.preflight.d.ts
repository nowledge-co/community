import type { DiscordMessagePreflightContext, DiscordMessagePreflightParams } from "./message-handler.preflight.types.js";
import { type ThreadBindingRecord } from "./thread-bindings.js";
export type { DiscordMessagePreflightContext, DiscordMessagePreflightParams, } from "./message-handler.preflight.types.js";
export declare function resolvePreflightMentionRequirement(params: {
    shouldRequireMention: boolean;
    isBoundThreadSession: boolean;
}): boolean;
export declare function shouldIgnoreBoundThreadWebhookMessage(params: {
    accountId?: string;
    threadId?: string;
    webhookId?: string | null;
    threadBinding?: ThreadBindingRecord;
}): boolean;
export declare function preflightDiscordMessage(params: DiscordMessagePreflightParams): Promise<DiscordMessagePreflightContext | null>;
