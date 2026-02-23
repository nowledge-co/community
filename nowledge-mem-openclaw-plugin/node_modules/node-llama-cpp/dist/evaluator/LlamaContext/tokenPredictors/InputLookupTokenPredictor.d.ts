import { Token } from "../../../types.js";
import { TokenPredictor } from "../TokenPredictor.js";
/**
 * Attempts to find the last few generated tokens in the input (prompt) tokens to predict the next tokens.
 *
 * This is useful in input-grounded tasks (when the model frequently repeats some of the input tokens in the output,
 * such as in text summarization or modifying code).
 *
 * This works in all completion classes, including `LlamaChatSession`, `LlamaChat`, and `LlamaCompletion`.
 *
 * Based on https://github.com/apoorvumang/prompt-lookup-decoding.
 * @see [Using Token Predictors: Input Lookup Token Predictor](https://node-llama-cpp.withcat.ai/guide/token-prediction#input-lookup)
 */
export declare class InputLookupTokenPredictor extends TokenPredictor {
    constructor(options?: {
        patternLength?: {
            /**
             * Min pattern length to look for in the input tokens.
             *
             * Defaults to `1`.
             */
            min?: number;
            /**
             * Max pattern length to look for in the input tokens.
             *
             * Set to `0` to disable the max pattern size.
             *
             * Defaults to `0`.
             */
            max?: number;
        };
        predictionLength?: {
            /**
             * Minimum number of tokens to predict.
             *
             * Defaults to `1`.
             */
            min?: number;
            /**
             * Maximum number of tokens to predict.
             *
             * Defaults to `3`.
             */
            max?: number;
        };
    });
    get patternMinLength(): number;
    get patternMaxLength(): number;
    get predictionMinLength(): number;
    get predictionMaxLength(): number;
    reset({ stateTokens }: {
        stateTokens: Token[];
    }): void;
    updateInputTokens(tokens: Token[]): void;
    pushTokens(tokens: Token[]): void;
    predictTokens(): Token[];
    dispose(): void;
}
