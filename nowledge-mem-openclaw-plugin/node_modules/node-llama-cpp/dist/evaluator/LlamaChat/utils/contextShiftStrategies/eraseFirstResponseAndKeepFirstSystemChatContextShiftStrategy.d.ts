import { ChatHistoryItem, Tokenizer } from "../../../../types.js";
import { ChatWrapper } from "../../../../ChatWrapper.js";
export declare function eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy({ chatHistory, maxTokensCount, tokenizer, chatWrapper, lastShiftMetadata }: {
    chatHistory: ChatHistoryItem[];
    maxTokensCount: number;
    tokenizer: Tokenizer;
    chatWrapper: ChatWrapper;
    lastShiftMetadata?: object | null;
}): Promise<{
    chatHistory: ChatHistoryItem[];
    metadata: CalculationMetadata;
}>;
type CalculationMetadata = {
    removedCharactersNumber: number;
};
export {};
