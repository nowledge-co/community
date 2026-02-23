import { ChatWrapper } from "../ChatWrapper.js";
import { ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class DeepSeekChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly keepOnlyLastThought: boolean;
    readonly functionCallingSyntax: "r1-workaround" | "simplified" | "original";
    readonly parallelFunctionCalling: boolean;
    readonly settings: ChatWrapperSettings;
    constructor(options?: {
        /**
         * Whether to keep only the chain of thought from the last model response.
         *
         * Setting this to `false` will keep all the chain of thoughts from the model responses in the context state.
         *
         * Defaults to `true`.
         */
        keepOnlyLastThought?: boolean;
        /**
         * Use a different variation function calling syntax to improve syntax compliance.
         *
         * Defaults to `"r1-workaround"`.
         */
        functionCallingSyntax?: "r1-workaround" | "simplified" | "original";
        /**
         * Support parallel function calling.
         *
         * May not work well with all distill model variations, as some distillation models make unnecessary additional calls in parallel.
         *
         * Defaults to `false`.
         */
        parallelFunctionCalling?: boolean;
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
}
