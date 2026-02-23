import { ChatWrapper } from "../ChatWrapper.js";
import { ChatHistoryItem, ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class Llama3_2LightweightChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly cuttingKnowledgeDate?: Date | (() => Date) | null;
    readonly todayDate: Date | (() => Date) | null;
    readonly noToolInstructions: boolean;
    readonly settings: ChatWrapperSettings;
    /**
     * @param options
     */
    constructor(options?: {
        /**
         * Set to `null` to disable
         *
         * Defaults to December 2023
         */
        cuttingKnowledgeDate?: Date | (() => Date) | number | string | null;
        /**
         * Set to `null` to disable
         *
         * Defaults to current date
         */
        todayDate?: Date | (() => Date) | number | string | null;
        noToolInstructions?: boolean;
    });
    addAvailableFunctionsSystemMessageToHistory(history: readonly ChatHistoryItem[], availableFunctions?: ChatModelFunctions, { documentParams }?: {
        documentParams?: boolean;
    }): readonly ChatHistoryItem[];
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
    prependPreambleToChatHistory(chatHistory: readonly ChatHistoryItem[]): readonly ChatHistoryItem[];
}
