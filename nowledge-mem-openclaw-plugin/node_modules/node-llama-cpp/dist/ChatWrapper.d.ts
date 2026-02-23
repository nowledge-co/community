import { ChatHistoryItem, ChatModelFunctionCall, ChatModelFunctions, ChatModelResponse, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperGenerateInitialHistoryOptions, ChatWrapperSettings } from "./types.js";
import { LlamaText } from "./utils/LlamaText.js";
import type { JinjaTemplateChatWrapperOptions } from "./chatWrappers/generic/JinjaTemplateChatWrapper.js";
export declare abstract class ChatWrapper {
    static defaultSettings: ChatWrapperSettings;
    abstract readonly wrapperName: string;
    readonly settings: ChatWrapperSettings;
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateFunctionCallsAndResults(functionCalls: ChatModelFunctionCall[], useRawCall?: boolean): import("./utils/LlamaText.js")._LlamaText;
    generateFunctionCall(name: string, params: any): LlamaText;
    generateFunctionCallResult(functionName: string, functionParams: any, result: any): LlamaText;
    generateModelResponseText(modelResponse: ChatModelResponse["response"], useRawValues?: boolean): LlamaText;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): LlamaText;
    addAvailableFunctionsSystemMessageToHistory(history: readonly ChatHistoryItem[], availableFunctions?: ChatModelFunctions, { documentParams }?: {
        documentParams?: boolean;
    }): readonly ChatHistoryItem[];
    generateInitialChatHistory({ systemPrompt }?: ChatWrapperGenerateInitialHistoryOptions): ChatHistoryItem[];
}
type FirstItemOfTupleOrFallback<T extends any[], Fallback> = T extends [infer U, ...any[]] ? U : Fallback;
export type ChatWrapperJinjaMatchConfiguration<T extends typeof ChatWrapper> = Array<FirstItemOfTupleOrFallback<ConstructorParameters<T>, object> | [
    testConfig: FirstItemOfTupleOrFallback<ConstructorParameters<T>, object>,
    applyConfig: FirstItemOfTupleOrFallback<ConstructorParameters<T>, object>,
    testJinjaChatWrapperOptions?: JinjaTemplateChatWrapperOptions
]>;
export {};
