export type TelegramTarget = {
    chatId: string;
    messageThreadId?: number;
    chatType: "direct" | "group" | "unknown";
};
export declare function stripTelegramInternalPrefixes(to: string): string;
export declare function parseTelegramTarget(to: string): TelegramTarget;
export declare function resolveTelegramTargetChatType(target: string): "direct" | "group" | "unknown";
