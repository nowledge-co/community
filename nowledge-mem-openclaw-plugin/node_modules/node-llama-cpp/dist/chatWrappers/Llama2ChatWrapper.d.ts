import { ChatWrapper } from "../ChatWrapper.js";
import { ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState } from "../types.js";
export declare class Llama2ChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    constructor({ addSpaceBeforeEos }?: {
        /**
         * Default to `true`
         */
        addSpaceBeforeEos?: boolean;
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
}
