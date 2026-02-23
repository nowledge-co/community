import { ChatWrapper } from "../ChatWrapper.js";
import { ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class Llama3ChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly settings: ChatWrapperSettings;
    constructor({ parallelFunctionCalling }?: {
        /**
         * Defaults to `true`
         */
        parallelFunctionCalling?: boolean;
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
}
