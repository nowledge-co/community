import type { LlamaGrammar } from "./LlamaGrammar.js";
import type { LlamaModel } from "./LlamaModel/LlamaModel.js";
export type LlamaGrammarEvaluationStateOptions = {
    model: LlamaModel;
    grammar: LlamaGrammar;
};
/**
 * Grammar evaluation state is used to track the model response to determine the next allowed characters for the model to generate.
 *
 * Create a new grammar evaluation state for every response you generate with the model.
 *
 * This is only needed when using the `LlamaContext` class directly, since `LlamaChatSession` already handles this for you.
 */
export declare class LlamaGrammarEvaluationState {
    constructor(options: LlamaGrammarEvaluationStateOptions);
    constructor(existingState: LlamaGrammarEvaluationState);
    /** Clone the grammar evaluation state */
    clone(): LlamaGrammarEvaluationState;
}
