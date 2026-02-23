import { ChatHistoryItem, ChatModelFunctions, ChatWrapperSettings } from "../types.js";
import { ChatWrapper } from "../ChatWrapper.js";
import { LlamaChatResponseFunctionCall } from "../evaluator/LlamaChat/LlamaChat.js";
import { TokenBias } from "../evaluator/TokenBias.js";
import { LlamaGrammar } from "../evaluator/LlamaGrammar.js";
import { Llama } from "../bindings/Llama.js";
import { LlamaModel } from "../evaluator/LlamaModel/LlamaModel.js";
import { GbnfJsonSchema } from "./gbnfJson/types.js";
import { LlamaText } from "./LlamaText.js";
export declare class OpenAIFormat {
    readonly chatWrapper: ChatWrapper;
    constructor({ chatWrapper }: {
        chatWrapper: ChatWrapper;
    });
    /**
     * Convert `node-llama-cpp`'s chat history to OpenAI format.
     *
     * Note that this conversion is lossy, as OpenAI's format is more limited than `node-llama-cpp`'s.
     */
    toOpenAiChat<Functions extends ChatModelFunctions>({ chatHistory, functionCalls, functions, useRawValues }: {
        chatHistory: ChatHistoryItem[];
        functionCalls?: LlamaChatResponseFunctionCall<Functions>[];
        functions?: Functions;
        useRawValues?: boolean;
    }): OpenAiChatCreationOptions;
    fromOpenAiChat<Functions extends ChatModelFunctions = ChatModelFunctions>(options: OpenAiChatCreationOptions, { llama, model }?: {
        llama?: Llama;
        model?: LlamaModel;
    }): Promise<{
        chatHistory: ChatHistoryItem[];
        functionCalls?: LlamaChatResponseFunctionCall<ChatModelFunctions>[];
        functions?: Functions;
        tokenBias?: TokenBias;
        maxTokens?: number;
        maxParallelFunctionCalls?: number;
        grammar?: LlamaGrammar;
        seed?: number;
        customStopTriggers?: string[];
        temperature?: number;
        minP?: number;
        topK?: number;
        topP?: number;
    }>;
}
export declare function fromIntermediateToCompleteOpenAiMessages(messages: IntermediateOpenAiMessage[]): (OpenAiChatSystemMessage | OpenAiChatUserMessage | OpenAiChatToolMessage | OpenAiChatAssistantMessage | {
    content: string;
    role: "assistant";
    tool_calls?: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string | any;
        };
    }>;
})[];
export declare function fromChatHistoryToIntermediateOpenAiMessages<Functions extends ChatModelFunctions>({ chatHistory, chatWrapperSettings, functionCalls, functions, useRawValues, combineModelMessageAndToolCalls, stringifyFunctionParams, stringifyFunctionResults, squashModelTextResponses }: {
    chatHistory: readonly ChatHistoryItem[];
    chatWrapperSettings: ChatWrapperSettings;
    functionCalls?: LlamaChatResponseFunctionCall<Functions>[];
    functions?: Functions;
    useRawValues?: boolean;
    combineModelMessageAndToolCalls?: boolean;
    stringifyFunctionParams?: boolean;
    stringifyFunctionResults?: boolean;
    squashModelTextResponses?: boolean;
}): IntermediateOpenAiConversionFromChatHistory;
export type IntermediateOpenAiConversionFromChatHistory = {
    messages: IntermediateOpenAiMessage[];
    tools?: OpenAiChatTool[];
};
export type OpenAiChatCreationOptions = {
    messages: OpenAiChatMessage[];
    tools?: OpenAiChatTool[];
    "tool_choice"?: "none" | "auto";
    "logit_bias"?: Record<string, number> | null;
    "max_completion_tokens"?: number | null;
    /** Overridden by `"max_completion_tokens"` */
    "max_tokens"?: number | null;
    "parallel_tool_calls"?: boolean;
    /**
     * Only used when a Llama instance is provided.
     * A llama instance is provided through a context sequence.
     */
    "response_format"?: {
        type: "text";
    } | {
        type: "json_schema";
        "json_schema": {
            name: string;
            description?: string;
            schema?: GbnfJsonSchema;
            strict?: boolean | null;
        };
    } | {
        type: "json_object";
    };
    seed?: number | null;
    stop?: string | null | string[];
    temperature?: number | null;
    "min_p"?: number | null;
    "top_p"?: number | null;
    "top_k"?: number | null;
};
type OpenAiChatTool = {
    type: "function";
    function: {
        name: string;
        description?: string;
        parameters?: GbnfJsonSchema;
        strict?: boolean | null;
    };
};
export type IntermediateOpenAiMessage = (Omit<OpenAiChatSystemMessage, "content"> & {
    content: LlamaText | string;
} | Omit<OpenAiChatUserMessage, "content"> & {
    content: LlamaText | string;
} | Omit<OpenAiChatToolMessage, "content"> & {
    content: LlamaText | string;
} | Omit<OpenAiChatAssistantMessage, "content" | "tool_calls"> & {
    content?: LlamaText | string;
    "tool_calls"?: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string | any;
        };
    }>;
});
export type OpenAiChatMessage = OpenAiChatSystemMessage | OpenAiChatUserMessage | OpenAiChatAssistantMessage | OpenAiChatToolMessage;
export type OpenAiChatSystemMessage = {
    role: "system";
    content: string | {
        type: "text";
        text: string;
    }[];
};
export type OpenAiChatUserMessage = {
    role: "user";
    content: string | {
        type: "text";
        text: string;
    }[];
};
export type OpenAiChatAssistantMessage = {
    role: "assistant";
    content?: string | {
        type: "text";
        text: string;
    }[] | null;
    "tool_calls"?: Array<{
        id: string;
        type: "function";
        function: {
            name: string;
            arguments: string;
        };
    }>;
};
export type OpenAiChatToolMessage = {
    role: "tool";
    content: string | {
        type: "text";
        text: string;
    }[];
    "tool_call_id": string;
};
export declare function resolveOpenAiText(text: string | {
    type: "text";
    text: string;
}[]): string;
export declare function resolveOpenAiText(text: string | {
    type: "text";
    text: string;
}[] | null | undefined): string | null;
export {};
