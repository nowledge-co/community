import type { SlackMonitorContext } from "./context.js";
export declare function resolveSlackEffectiveAllowFrom(ctx: SlackMonitorContext): Promise<{
    allowFrom: string[];
    allowFromLower: string[];
}>;
export declare function isSlackSenderAllowListed(params: {
    allowListLower: string[];
    senderId: string;
    senderName?: string;
}): boolean;
