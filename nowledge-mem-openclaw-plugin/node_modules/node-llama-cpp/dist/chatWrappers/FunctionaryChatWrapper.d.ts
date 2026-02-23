import { ChatWrapper } from "../ChatWrapper.js";
import { ChatHistoryItem, ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class FunctionaryChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly variation: "v3" | "v2" | "v2.llama3";
    readonly settings: ChatWrapperSettings;
    constructor({ variation }?: {
        variation?: "v3" | "v2" | "v2.llama3";
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
    addAvailableFunctionsSystemMessageToHistory(history: readonly ChatHistoryItem[], availableFunctions?: ChatModelFunctions, { documentParams }?: {
        documentParams?: boolean;
    }): readonly ChatHistoryItem[];
}
