import { EventRelay } from "lifecycle-utils";
import { LLamaContextualRepeatPenalty, Token } from "../types.js";
import { LlamaText } from "../utils/LlamaText.js";
import { LlamaGrammar } from "./LlamaGrammar.js";
import { EvaluationPriority } from "./LlamaContext/types.js";
import { LlamaContextSequence } from "./LlamaContext/LlamaContext.js";
import { TokenBias } from "./TokenBias.js";
export type LlamaCompletionOptions = {
    contextSequence: LlamaContextSequence;
    /**
     * Automatically dispose the sequence when the object is disposed.
     *
     * Defaults to `false`.
     */
    autoDisposeSequence?: boolean;
};
export type LlamaCompletionGenerationOptions = {
    /**
     * Called as the model generates a completion with the generated text chunk.
     *
     * Useful for streaming the generated completion as it's being generated.
     */
    onTextChunk?: (text: string) => void;
    /**
     * Called as the model generates a completion with the generated tokens.
     *
     * Preferably, you'd want to use `onTextChunk` instead of this.
     */
    onToken?: (tokens: Token[]) => void;
    /**
     * An AbortSignal to later abort the generation.
     *
     * When the signal is aborted, the generation will stop and throw `signal.reason` as the error.
     *
     * > To stop an ongoing generation without throwing an error, also set `stopOnAbortSignal` to `true`.
     */
    signal?: AbortSignal;
    /**
     * When a completion already started being generated and then the signal is aborted,
     * the generation will stop and the completion will be returned as is instead of throwing an error.
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
     * Disabled by default.
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
    grammar?: LlamaGrammar;
    /**
     * Custom stop triggers to stop the completion when any of the provided triggers are found.
     */
    customStopTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[];
    /**
     * The number of tokens to delete from the context window to make space for new ones.
     * Defaults to 10% of the context size.
     */
    contextShiftSize?: number | ((sequence: LlamaContextSequence) => number | Promise<number>);
    /**
     * Context shift reconstructs the context with partial relevant data to continue generation when the context fills up.
     * This flag disables this behavior.
     * This flag will cause the generation to stop when the context fills up
     * by setting an appropriate `maxTokens` value or lowering the given `maxTokens` value when needed.
     * This flag will cause the generation to fail if there's no space for generating new tokens at all with the given inputs.
     *
     * Disabled by default. Not recommended unless you know what you're doing.
     */
    disableContextShift?: boolean;
};
export type LlamaInfillGenerationOptions = LlamaCompletionGenerationOptions & {
    /**
     * The minimum number of tokens to keep from the prefix input when making a context shift.
     * Defaults to 10% of the context size.
     */
    minPrefixKeepTokens?: number | ((sequence: LlamaContextSequence) => number | Promise<number>);
};
export type LlamaCompletionResponse = {
    response: string;
    metadata: {
        remainingGenerationAfterStop?: string | Token[];
        stopReason: "eogToken" | "stopGenerationTrigger" | "maxTokens" | "abort";
    } | {
        remainingGenerationAfterStop?: string | Token[];
        stopReason: "customStopTrigger";
        customStopTrigger: (string | Token)[];
    };
};
/**
 * @see [Text Completion](https://node-llama-cpp.withcat.ai/guide/text-completion) tutorial
 */
export declare class LlamaCompletion {
    readonly onDispose: EventRelay<void>;
    constructor({ contextSequence, autoDisposeSequence }: LlamaCompletionOptions);
    dispose({ disposeSequence }?: {
        disposeSequence?: boolean;
    }): void;
    /** @hidden */
    [Symbol.dispose](): void;
    get disposed(): boolean;
    get infillSupported(): boolean;
    /**
     * Generate a completion for an input.
     */
    generateCompletion(input: Token[] | string | LlamaText, options?: LlamaCompletionGenerationOptions): Promise<string>;
    /**
     * Same as `generateCompletion`, but returns additional metadata about the generation.
     * See `generateCompletion` for more information.
     */
    generateCompletionWithMeta(input: Token[] | string | LlamaText, { onTextChunk, onToken, signal, stopOnAbortSignal, maxTokens, temperature, minP, topK, topP, seed, trimWhitespaceSuffix, repeatPenalty, tokenBias, evaluationPriority, grammar, customStopTriggers, contextShiftSize, disableContextShift }?: LlamaCompletionGenerationOptions): Promise<LlamaCompletionResponse>;
    /**
     * Infill (also known as Fill-In-Middle), generates a completion for an input (`prefixInput`) that
     * should connect to a given continuation (`suffixInput`).
     * For example, for `prefixInput: "123"` and `suffixInput: "789"`, the model is expected to generate `456`
     * to make the final text be `123456789`.
     */
    generateInfillCompletion(prefixInput: Token[] | string | LlamaText, suffixInput: Token[] | string | LlamaText, options?: LlamaInfillGenerationOptions): Promise<string>;
    /**
     * Same as `generateInfillCompletion`, but returns additional metadata about the generation.
     * See `generateInfillCompletion` for more information.
     */
    generateInfillCompletionWithMeta(prefixInput: Token[] | string | LlamaText, suffixInput: Token[] | string | LlamaText, { onTextChunk, onToken, signal, stopOnAbortSignal, maxTokens, temperature, minP, topK, topP, seed, trimWhitespaceSuffix, repeatPenalty, tokenBias, evaluationPriority, grammar, contextShiftSize, customStopTriggers, minPrefixKeepTokens, disableContextShift }?: LlamaInfillGenerationOptions): Promise<LlamaCompletionResponse>;
}
