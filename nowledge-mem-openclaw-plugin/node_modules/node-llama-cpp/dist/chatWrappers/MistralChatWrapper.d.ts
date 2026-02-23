import { ChatWrapper } from "../ChatWrapper.js";
import { ChatHistoryItem, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperGenerateInitialHistoryOptions, ChatWrapperSettings } from "../types.js";
export declare class MistralChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly settings: ChatWrapperSettings;
    constructor(options?: {
        /**
         * Default to `true`
         */
        addSpaceBeforeEos?: boolean;
    });
    addAvailableFunctionsSystemMessageToHistory(history: readonly ChatHistoryItem[]): readonly ChatHistoryItem[];
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateInitialChatHistory({ systemPrompt }?: ChatWrapperGenerateInitialHistoryOptions): ChatHistoryItem[];
    generateFunctionCallResult(functionName: string, functionParams: any, result: any): import("../utils/LlamaText.js")._LlamaText;
}
