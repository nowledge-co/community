import { ChatWrapper } from "../ChatWrapper.js";
import { ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState } from "../types.js";
/**
 * This chat wrapper is not safe against chat syntax injection attacks
 * ([learn more](https://node-llama-cpp.withcat.ai/guide/llama-text#input-safety-in-node-llama-cpp)).
 */
export declare class GeneralChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    constructor({ userMessageTitle, modelResponseTitle, middleSystemMessageTitle, allowSpecialTokensInTitles }?: {
        userMessageTitle?: string;
        modelResponseTitle?: string;
        middleSystemMessageTitle?: string;
        allowSpecialTokensInTitles?: boolean;
    });
    get userMessageTitle(): string;
    get modelResponseTitle(): string;
    get middleSystemMessageTitle(): string;
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
}
