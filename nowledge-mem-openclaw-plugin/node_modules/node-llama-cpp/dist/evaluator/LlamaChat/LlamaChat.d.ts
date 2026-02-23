import { EventRelay } from "lifecycle-utils";
import { ChatWrapper } from "../../ChatWrapper.js";
import { LlamaContextSequence } from "../LlamaContext/LlamaContext.js";
import { ChatHistoryItem, ChatModelFunctions, ChatModelSegmentType, LLamaContextualRepeatPenalty, Token, Tokenizer } from "../../types.js";
import { GbnfJsonSchemaToType } from "../../utils/gbnfJson/types.js";
import { LlamaGrammar } from "../LlamaGrammar.js";
import { LlamaText, LlamaTextJSON } from "../../utils/LlamaText.js";
import { EvaluationPriority } from "../LlamaContext/types.js";
import { TokenBias } from "../TokenBias.js";
import { LlamaModel } from "../LlamaModel/LlamaModel.js";
export type LlamaChatOptions = {
    contextSequence: LlamaContextSequence;
    /** `"auto"` is used by default */
    chatWrapper?: "auto" | ChatWrapper;
    /**
     * Automatically dispose the sequence when the session is disposed
     *
     * Defaults to `false`.
     */
    autoDisposeSequence?: boolean;
};
export type LlamaChatResponseChunk = LlamaChatResponseTextChunk | LlamaChatResponseSegmentChunk;
export type LlamaChatResponseTextChunk = {
    /** When `type` is `undefined`, the chunk is part of the main response and is not a segment */
    type: undefined;
    /**
     * `segmentType` has no purpose when `type` is `undefined` (meaning that this chunk is part of the main response and is not a segment).
     */
    segmentType: undefined;
    /**
     * The generated text chunk.
     *
     * Detokenized from the `tokens` property,
     * but with the context of the previous generation (for better spacing of the text with some models).
     *
     * Prefer using this property over `tokens` when streaming the generated response as text.
     */
    text: string;
    /** The generated tokens */
    tokens: Token[];
};
export type LlamaChatResponseSegmentChunk = {
    type: "segment";
    /** Segment type */
    segmentType: ChatModelSegmentType;
    /**
     * The generated text chunk.
     *
     * Detokenized from the `tokens` property,
     * but with the context of the previous generation (for better spacing of the text with some models).
     *
     * Prefer using this property over `tokens` when streaming the generated response as text.
     */
    text: string;
    /** The generated tokens */
    tokens: Token[];
    /**
     * When the current chunk is the start of a segment, this field will be set.
     *
     * It's possible that a chunk with no tokens and empty text will be emitted just to set this field
     * to signify that the segment has started.
     */
    segmentStartTime?: Date;
    /**
     * When the current chunk is the last one of a segment (meaning the current segment has ended), this field will be set.
     *
     * It's possible that a chunk with no tokens and empty text will be emitted just to set this field
     * to signify that the segment has ended.
     */
    segmentEndTime?: Date;
};
export type LlamaChatResponseFunctionCallParamsChunk = {
    /**
     * Each different function call has a different `callIndex`.
     *
     * When the previous function call has finished being generated, the `callIndex` of the next one will increment.
     *
     * Use this value to distinguish between different function calls.
     */
    callIndex: number;
    /**
     * The name of the function being called
     */
    functionName: string;
    /**
     * A chunk of the generated text used for the function call parameters.
     *
     * Collect all the chunks together to construct the full function call parameters.
     *
     * After the function call is finished, the entire constructed params text can be parsed as a JSON object,
     * according to the function parameters schema.
     */
    paramsChunk: string;
    /**
     * When this is `true`, the current chunk is the last chunk in the generation of the current function call parameters.
     */
    done: boolean;
};
export type LLamaChatGenerateResponseOptions<Functions extends ChatModelFunctions | undefined = undefined> = {
    /**
     * Called as the model generates the main response with the generated text chunk.
     *
     * Useful for streaming the generated response as it's being generated.
     *
     * Includes only the main response without any text segments (like thoughts).
     * For streaming the response with segments, use {@link onResponseChunk `onResponseChunk`}.
     */
    onTextChunk?: (text: string) => void;
    /**
     * Called as the model generates the main response with the generated tokens.
     *
     * Preferably, you'd want to use {@link onTextChunk `onTextChunk`} instead of this.
     *
     * Includes only the main response without any segments (like thoughts).
     * For streaming the response with segments, use {@link onResponseChunk `onResponseChunk`}.
     */
    onToken?: (tokens: Token[]) => void;
    /**
     * Called as the model generates a response with the generated text and tokens,
     * including segment information (when the generated output is part of a segment).
     *
     * Useful for streaming the generated response as it's being generated, including the main response and all segments.
     *
     * Only use this function when you need the segmented texts, like thought segments (chain of thought text).
     */
    onResponseChunk?: (chunk: LlamaChatResponseChunk) => void;
    /**
     * An AbortSignal to later abort the generation.
     *
     * When the signal is aborted, the generation will stop and throw `signal.reason` as the error.
     *
     * > To stop an ongoing generation without throwing an error, also set `stopOnAbortSignal` to `true`.
     */
    signal?: AbortSignal;
    /**
     * When a response already started being generated and then the signal is aborted,
     * the generation will stop and the response will be returned as is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: boolean;
    /** Maximum number of tokens to generate */
    maxTokens?: number;
    /**
     * Temperature is a hyperparameter that controls the randomness of the generated text.
     * It affects the probability distribution of the model's output tokens.
     *
     * A higher temperature (e.g., 1.5) makes the output more random and creative,
     * while a lower temperature (e.g., 0.5) makes the output more focused, deterministic, and conservative.
     *
     * The suggested temperature is 0.8, which provides a balance between randomness and determinism.
     *
     * At the extreme, a temperature of 0 will always pick the most likely next token, leading to identical outputs in each run.
     *
     * Set to `0` to disable.
     * Disabled by default (set to `0`).
     */
    temperature?: number;
    /**
     * From the next token candidates, discard the percentage of tokens with the lowest probability.
     * For example, if set to `0.05`, 5% of the lowest probability tokens will be discarded.
     * This is useful for generating more high-quality results when using a high temperature.
     * Set to a value between `0` and `1` to enable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     * Disabled by default.
     */
    minP?: number;
    /**
     * Limits the model to consider only the K most likely next tokens for sampling at each step of sequence generation.
     * An integer number between `1` and the size of the vocabulary.
     * Set to `0` to disable (which uses the full vocabulary).
     *
     * Only relevant when `temperature` is set to a value greater than 0.
     */
    topK?: number;
    /**
     * Dynamically selects the smallest set of tokens whose cumulative probability exceeds the threshold P,
     * and samples the next token only from this set.
     * A float number between `0` and `1`.
     * Set to `1` to disable.
     *
     * Only relevant when `temperature` is set to a value greater than `0`.
     */
    topP?: number;
    /**
     * Used to control the randomness of the generated text.
     *
     * Change the seed to get different results.
     *
     * Only relevant when using `temperature`.
     */
    seed?: number;
    /**
     * Trim whitespace from the end of the generated text
     *
     * Defaults to `false`.
     */
    trimWhitespaceSuffix?: boolean;
    repeatPenalty?: false | LLamaContextualRepeatPenalty;
    /**
     * Adjust the probability of tokens being generated.
     * Can be used to bias the model to generate tokens that you want it to lean towards,
     * or to avoid generating tokens that you want it to avoid.
     */
    tokenBias?: TokenBias | (() => TokenBias);
    /**
     * See the parameter `evaluationPriority` on the `LlamaContextSequence.evaluate()` function for more information.
     */
    evaluationPriority?: EvaluationPriority;
    contextShift?: LLamaChatContextShiftOptions;
    /**
     * Custom stop triggers to stop the generation of the response when any of the provided triggers are found.
     */
    customStopTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[];
    /**
     * The evaluation context window returned from the last evaluation.
     * This is an optimization to utilize existing context sequence state better when possible.
     */
    lastEvaluationContextWindow?: {
        /** The history of the last evaluation. */
        history?: ChatHistoryItem[];
        /**
         * Minimum overlap percentage with existing context sequence state to use the last evaluation context window.
         * If the last evaluation context window is not used, a new context will be generated based on the full history,
         * which will decrease the likelihood of another context shift happening so soon.
         *
         * A number between `0` (exclusive) and `1` (inclusive).
         */
        minimumOverlapPercentageToPreventContextShift?: number;
    };
    /**
     * Called as the model generates function calls with the generated parameters chunk for each function call.
     *
     * Useful for streaming the generated function call parameters as they're being generated.
     * Only useful in specific use cases,
     * such as showing the generated textual file content as it's being generated (note that doing this requires parsing incomplete JSON).
     *
     * The constructed text from all the params chunks of a given function call can be parsed as a JSON object,
     * according to the function parameters schema.
     *
     * Each function call has its own `callIndex` you can use to distinguish between them.
     *
     * Only relevant when using function calling (via passing the `functions` option).
     */
    onFunctionCallParamsChunk?: (chunk: LlamaChatResponseFunctionCallParamsChunk) => void;
    /**
     * Set the maximum number of tokens the model is allowed to spend on various segmented responses.
     */
    budgets?: {
        /**
         * Whether to include the tokens already consumed by the current model response being completed in the budget.
         *
         * Defaults to `true`.
         */
        includeCurrentResponse?: boolean;
        /**
         * Budget for thought tokens.
         *
         * Defaults to `Infinity`.
         */
        thoughtTokens?: number;
        /**
         * Budget for comment tokens.
         *
         * Defaults to `Infinity`.
         */
        commentTokens?: number;
    };
    /**
     * Stop the generation when the model tries to generate a non-textual segment or call a function.
     *
     * Useful for generating completions in a form of a model response.
     *
     * Defaults to `false`.
     */
    abortOnNonText?: boolean;
} & ({
    grammar?: LlamaGrammar;
    functions?: never;
    documentFunctionParams?: never;
    maxParallelFunctionCalls?: never;
    onFunctionCall?: never;
    onFunctionCallParamsChunk?: never;
} | {
    grammar?: never;
    functions?: Functions | ChatModelFunctions;
    documentFunctionParams?: boolean;
    maxParallelFunctionCalls?: number;
    onFunctionCall?: (functionCall: LlamaChatResponseFunctionCall<Functions extends ChatModelFunctions ? Functions : ChatModelFunctions>) => void;
    onFunctionCallParamsChunk?: (chunk: LlamaChatResponseFunctionCallParamsChunk) => void;
});
export type LLamaChatLoadAndCompleteUserMessageOptions<Functions extends ChatModelFunctions | undefined = undefined> = {
    /**
     * Complete the given user prompt without adding it or the completion to the returned context window.
     */
    initialUserPrompt?: string;
    /**
     * When a completion already started being generated and then the signal is aborted,
     * the generation will stop and the completion will be returned as is instead of throwing an error.
     *
     * Defaults to `false`.
     */
    stopOnAbortSignal?: boolean;
    /**
     * Called as the model generates a completion with the generated text chunk.
     *
     * Useful for streaming the generated completion as it's being generated.
     */
    onTextChunk?: LLamaChatGenerateResponseOptions<Functions>["onTextChunk"];
    /**
     * Called as the model generates a completion with the generated tokens.
     *
     * Preferably, you'd want to use `onTextChunk` instead of this.
     */
    onToken?: LLamaChatGenerateResponseOptions<Functions>["onToken"];
    signal?: LLamaChatGenerateResponseOptions<Functions>["signal"];
    maxTokens?: LLamaChatGenerateResponseOptions<Functions>["maxTokens"];
    temperature?: LLamaChatGenerateResponseOptions<Functions>["temperature"];
    minP?: LLamaChatGenerateResponseOptions<Functions>["minP"];
    topK?: LLamaChatGenerateResponseOptions<Functions>["topK"];
    topP?: LLamaChatGenerateResponseOptions<Functions>["topP"];
    seed?: LLamaChatGenerateResponseOptions<Functions>["seed"];
    trimWhitespaceSuffix?: LLamaChatGenerateResponseOptions<Functions>["trimWhitespaceSuffix"];
    repeatPenalty?: LLamaChatGenerateResponseOptions<Functions>["repeatPenalty"];
    tokenBias?: LLamaChatGenerateResponseOptions<Functions>["tokenBias"];
    evaluationPriority?: LLamaChatGenerateResponseOptions<Functions>["evaluationPriority"];
    contextShift?: LLamaChatGenerateResponseOptions<Functions>["contextShift"];
    customStopTriggers?: LLamaChatGenerateResponseOptions<Functions>["customStopTriggers"];
    lastEvaluationContextWindow?: LLamaChatGenerateResponseOptions<Functions>["lastEvaluationContextWindow"];
    grammar?: LlamaGrammar;
    /**
     * Functions are not used by the model here,
     * but are used for keeping the instructions given to the model about the functions in the current context state,
     * to avoid context shifts.
     *
     * It's best to provide the same functions that were used for the previous prompt here.
     */
    functions?: Functions | ChatModelFunctions;
    /**
     * Functions are not used by the model here,
     * but are used for keeping the instructions given to the model about the functions in the current context state,
     * to avoid context shifts.
     *
     * It's best to provide the same value that was used for the previous prompt here.
     */
    documentFunctionParams?: boolean;
};
export type LLamaChatContextShiftOptions = {
    /**
     * The number of tokens to delete from the context window to make space for new ones.
     * Defaults to 10% of the context size.
     */
    size?: number | ((sequence: LlamaContextSequence) => number | Promise<number>);
    /**
     * The strategy to use when deleting tokens from the context window.
     *
     * Defaults to `"eraseFirstResponseAndKeepFirstSystem"`.
     */
    strategy?: "eraseFirstResponseAndKeepFirstSystem" | ((options: {
        /** Full chat history */
        chatHistory: readonly ChatHistoryItem[];
        /** Maximum number of tokens that the new chat history should fit under when tokenized */
        maxTokensCount: number;
        /** Tokenizer used to tokenize the chat history */
        tokenizer: Tokenizer;
        /** Chat wrapper used to generate the context state */
        chatWrapper: ChatWrapper;
        /**
         * The metadata returned from the last context shift strategy call.
         * Will be `null` on the first call.
         */
        lastShiftMetadata?: object | null;
    }) => {
        chatHistory: ChatHistoryItem[];
        metadata?: object | null;
    } | Promise<{
        chatHistory: ChatHistoryItem[];
        metadata?: object | null;
    }>);
    /**
     * The `contextShiftMetadata` returned from the last evaluation.
     * This is an optimization to utilize the existing context state better when possible.
     */
    lastEvaluationMetadata?: object | undefined | null;
};
export declare class LlamaChat {
    readonly onDispose: EventRelay<void>;
    constructor({ contextSequence, chatWrapper, autoDisposeSequence }: LlamaChatOptions);
    dispose({ disposeSequence }?: {
        disposeSequence?: boolean;
    }): void;
    /** @hidden */
    [Symbol.dispose](): void;
    get disposed(): boolean;
    get chatWrapper(): ChatWrapper;
    get sequence(): LlamaContextSequence;
    get context(): import("../LlamaContext/LlamaContext.js").LlamaContext;
    get model(): LlamaModel;
    generateResponse<const Functions extends ChatModelFunctions | undefined = undefined>(history: ChatHistoryItem[], options?: LLamaChatGenerateResponseOptions<Functions>): Promise<LlamaChatResponse<Functions>>;
    loadChatAndCompleteUserMessage<const Functions extends ChatModelFunctions | undefined = undefined>(history: ChatHistoryItem[], options?: LLamaChatLoadAndCompleteUserMessageOptions<Functions>): Promise<LlamaChatLoadAndCompleteUserResponse>;
}
export type LlamaChatResponse<Functions extends ChatModelFunctions | undefined = undefined> = {
    /**
     * The response text only, _without_ any text segments (like thoughts).
     */
    response: string;
    /**
     * The full response, including all text and text segments (like thoughts).
     */
    fullResponse: Array<string | LlamaChatResponseSegment>;
    functionCalls?: Functions extends ChatModelFunctions ? LlamaChatResponseFunctionCall<Functions>[] : never;
    lastEvaluation: {
        cleanHistory: ChatHistoryItem[];
        contextWindow: ChatHistoryItem[];
        contextShiftMetadata: any;
    };
    metadata: {
        remainingGenerationAfterStop?: string | Token[];
        stopReason: "eogToken" | "stopGenerationTrigger" | "functionCalls" | "maxTokens" | "abort";
    } | {
        remainingGenerationAfterStop?: string | Token[];
        stopReason: "customStopTrigger";
        customStopTrigger: (string | Token)[];
    };
};
export type LlamaChatResponseFunctionCall<Functions extends ChatModelFunctions, FunctionCallName extends keyof Functions & string = string & keyof Functions, Params = Functions[FunctionCallName]["params"] extends undefined | null | void ? undefined : GbnfJsonSchemaToType<Functions[FunctionCallName]["params"]>> = {
    functionName: FunctionCallName;
    params: Params;
    raw: LlamaTextJSON;
};
export type LlamaChatResponseSegment = {
    type: "segment";
    segmentType: ChatModelSegmentType;
    text: string;
    ended: boolean;
    raw: LlamaTextJSON;
    startTime?: string;
    endTime?: string;
};
export type LlamaChatLoadAndCompleteUserResponse = {
    completion: string;
    lastEvaluation: {
        /**
         * The completion and initial user prompt are not added to this context window result,
         * but are loaded to the current context sequence state as tokens
         */
        contextWindow: ChatHistoryItem[];
        contextShiftMetadata: any;
    };
    metadata: {
        remainingGenerationAfterStop?: string | Token[];
        stopReason: "eogToken" | "stopGenerationTrigger" | "maxTokens" | "abort";
    } | {
        remainingGenerationAfterStop?: string | Token[];
        stopReason: "customStopTrigger";
        customStopTrigger: (string | Token)[];
    };
};
