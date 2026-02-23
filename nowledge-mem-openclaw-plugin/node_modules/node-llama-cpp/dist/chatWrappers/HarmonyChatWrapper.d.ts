import { ChatWrapper } from "../ChatWrapper.js";
import { ChatModelFunctions, ChatModelResponse, ChatWrapperGenerateContextStateOptions, ChatWrapperGeneratedContextState, ChatWrapperSettings } from "../types.js";
import { LlamaText } from "../utils/LlamaText.js";
export declare class HarmonyChatWrapper extends ChatWrapper {
    readonly wrapperName: string;
    readonly modelIdentity: string | null;
    readonly cuttingKnowledgeDate?: Date | (() => Date) | null;
    readonly todayDate: Date | (() => Date) | null;
    readonly reasoningEffort: "high" | "medium" | "low" | null;
    readonly requiredChannels: {
        analysis: boolean;
        commentary: boolean;
        final: boolean;
    };
    readonly keepOnlyLastThought: boolean;
    readonly settings: ChatWrapperSettings;
    constructor(options?: {
        /**
         * The model identity to use in the internal system message.
         *
         * Set to `null` to disable.
         *
         * Defaults to `"You are ChatGPT, a large language model trained by OpenAI."`
         */
        modelIdentity?: string | null;
        /**
         * Set to `null` to disable
         *
         * Defaults to `new Date("2024-06-01T00:00:00Z")`
         */
        cuttingKnowledgeDate?: Date | (() => Date) | number | string | null;
        /**
         * Set to `null` to disable
         *
         * Defaults to the current date
         */
        todayDate?: Date | (() => Date) | number | string | null;
        /**
         * The amount of reasoning to instruct the model to use.
         *
         * Not enforced, it's up to the model to follow this instruction.
         *
         * Set to `null` to omit the instruction.
         *
         * Defaults to `"medium"`.
         */
        reasoningEffort?: "high" | "medium" | "low" | null;
        requiredChannels?: {
            /**
             * Defaults to `true`
             */
            analysis?: boolean;
            /**
             * Defaults to `true`
             */
            commentary?: boolean;
            /**
             * Defaults to `true`
             */
            final?: boolean;
        };
        /**
         * Whether to keep only the chain of thought from the last model response.
         *
         * Setting this to `false` will keep all the chain of thoughts from the model responses in the context state.
         *
         * Defaults to `true`.
         */
        keepOnlyLastThought?: boolean;
    });
    generateContextState({ chatHistory, availableFunctions, documentFunctionParams }: ChatWrapperGenerateContextStateOptions): ChatWrapperGeneratedContextState;
    generateFunctionCall(name: string, params: any): LlamaText;
    generateFunctionCallResult(functionName: string, functionParams: any, result: any): LlamaText;
    generateModelResponseText(modelResponse: ChatModelResponse["response"], useRawValues?: boolean): LlamaText;
    generateAvailableFunctionsSystemText(availableFunctions: ChatModelFunctions, { documentParams }: {
        documentParams?: boolean;
    }): import("../utils/LlamaText.js")._LlamaText;
}
