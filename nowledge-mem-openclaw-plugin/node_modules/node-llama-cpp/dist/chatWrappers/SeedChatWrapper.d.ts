import { ChatWrapper } from "../ChatWrapper.js";
import { ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class SeedChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly thinkingBudget: number | 0 | null;
    readonly settings: ChatWrapperSettings;
    constructor(options?: {
        /**
         * The thinking budget to instruct the model to conform to.
         *
         * This is purely a request, the model may ignore it.
         *
         * Set to `0` to instruct the model to not use any reasoning.
         *
         * When set to `null`, the instruction will be omitted (unlimited reasoning).
         *
         * Defaults to `null`.
         */
        thinkingBudget?: number | 0 | null;
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
}
