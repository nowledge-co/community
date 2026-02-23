import { ChatWrapper } from "../ChatWrapper.js";
import { ChatModelFunctions, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
export declare class QwenChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly keepOnlyLastThought: boolean;
    readonly thoughts: "auto" | "discourage";
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
         * Control the usage of thoughts in the model responses.
         *
         * Defaults to `"auto"`.
         */
        thoughts?: "auto" | "discourage";
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateFunctionCallResult(functionName: string, functionParams: any, result: any): import("../utils/LlamaText.js")._LlamaText;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
}
