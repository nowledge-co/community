import { Token } from "../../../types.js";
import { SequenceEvaluateOptions } from "../types.js";
import { LlamaContextSequence } from "../LlamaContext.js";
import { TokenPredictor } from "../TokenPredictor.js";
/**
 * Predicts the next tokens by evaluating the current state of the target sequence
 * on a draft sequence from a smaller and faster draft model.
 * @see [Using Token Predictors: Draft Model Token Predictor](https://node-llama-cpp.withcat.ai/guide/token-prediction#draft-model)
 */
export declare class DraftSequenceTokenPredictor extends TokenPredictor {
    constructor(draftSequence: LlamaContextSequence, options?: {
        /**
         * The minimum number of tokens to draft.
         *
         * Defaults to `0`.
         */
        minTokens?: number;
        /**
         * Maximum number of tokens to draft.
         *
         * Defaults to `16`.
         */
        maxTokens?: number;
        /**
         * Evaluate options default to the values of the target sequence.
         *
         * You can override any of the options for the prediction here.
         */
        evaluateOptions?: Pick<SequenceEvaluateOptions, "temperature" | "minP" | "topK" | "topP" | "seed" | "repeatPenalty" | "tokenBias" | "evaluationPriority" | "contextShift">;
        /**
         * Minimum token confidence (probability of the token to be generated, assigned by the model) to consider the token as a prediction.
         * When the generated token confidence is lower than this value, the prediction process will stop until all the predicted tokens
         * are exhausted (either by a token that was not predicted being pushed, or all the generated predictions are consumed).
         *
         * A number between `0` and `1` representing the minimum probability of the token to be generated.
         *
         * Set to `0` to disable.
         *
         * Defaults to `0.6`.
         */
        minConfidence?: number;
    });
    get draftSequence(): LlamaContextSequence;
    get minTokens(): number;
    get maxTokens(): number;
    get minConfidence(): number | undefined;
    reset({ targetSequence, stateTokens, evaluateOptions }: {
        targetSequence: LlamaContextSequence;
        stateTokens: Token[];
        evaluateOptions: Readonly<SequenceEvaluateOptions>;
    }): Promise<void>;
    pushTokens(tokens: Token[]): void;
    predictTokens(): Token[] | Promise<Token[]>;
    stop(untilPredictionsExhausted?: boolean): void;
    dispose(): void;
}
