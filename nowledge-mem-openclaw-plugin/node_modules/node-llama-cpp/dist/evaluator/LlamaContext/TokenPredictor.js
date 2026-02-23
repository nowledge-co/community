/**
 * @see [Using Token Predictors](https://node-llama-cpp.withcat.ai/guide/token-prediction#custom)
 */
export class TokenPredictor {
    /**
     * Stops the prediction process when it runs in the background.
     * @param untilPredictionsExhausted - If true, the prediction process should not resume until the current predictions are exhausted.
     */
    stop(untilPredictionsExhausted) { }
    /**
     * Called with the input tokens before the generation starts when using `LlamaChatSession`, `LlamaChat`, and `LlamaCompletion`.
     */
    updateInputTokens(tokens) { }
    dispose() { }
    /** @hidden */
    [Symbol.dispose]() {
        return this.dispose();
    }
}
//# sourceMappingURL=TokenPredictor.js.map