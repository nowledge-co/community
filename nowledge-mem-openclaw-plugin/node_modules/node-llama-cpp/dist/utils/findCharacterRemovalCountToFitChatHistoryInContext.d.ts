import { ChatHistoryItem, Tokenizer } from "../types.js";
import { ChatWrapper } from "../ChatWrapper.js";
export declare function findCharacterRemovalCountToFitChatHistoryInContext({ compressChatHistory, chatHistory, tokensCountToFit, tokenizer, chatWrapper, initialCharactersRemovalCount, estimatedCharactersPerToken, maxDecompressionAttempts, failedCompressionErrorMessage }: {
    compressChatHistory(options: {
        chatHistory: readonly ChatHistoryItem[];
        charactersToRemove: number;
        estimatedCharactersPerToken: number;
    }): ChatHistoryItem[] | Promise<ChatHistoryItem[]>;
    chatHistory: ChatHistoryItem[];
    tokensCountToFit: number;
    tokenizer: Tokenizer;
    chatWrapper: ChatWrapper;
    initialCharactersRemovalCount?: number;
    estimatedCharactersPerToken?: number;
    maxDecompressionAttempts?: number;
    failedCompressionErrorMessage?: string;
}): Promise<{
    removedCharactersCount: number;
    compressedChatHistory: ChatHistoryItem[];
}>;
