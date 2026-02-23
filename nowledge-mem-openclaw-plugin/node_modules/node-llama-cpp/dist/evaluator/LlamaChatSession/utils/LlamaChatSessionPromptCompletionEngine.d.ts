import type { LlamaContextSequence } from "../../LlamaContext/LlamaContext.js";
import type { LLamaChatCompletePromptOptions } from "../LlamaChatSession.js";
export type LLamaChatPromptCompletionEngineOptions = {
    /**
     * Max tokens to allow for preloading a prompt and generating a completion for it.
     *
     * Defaults to `256` or half of the context size, whichever is smaller.
     */
    maxPreloadTokens?: number;
    onGeneration?(prompt: string, completion: string): void;
    /**
     * Max number of completions to cache.
     *
     * Defaults to `100`.
     */
    maxCachedCompletions?: number;
    temperature?: LLamaChatCompletePromptOptions["temperature"];
    minP?: LLamaChatCompletePromptOptions["minP"];
    topK?: LLamaChatCompletePromptOptions["topK"];
    topP?: LLamaChatCompletePromptOptions["topP"];
    seed?: LLamaChatCompletePromptOptions["seed"];
    trimWhitespaceSuffix?: LLamaChatCompletePromptOptions["trimWhitespaceSuffix"];
    evaluationPriority?: LLamaChatCompletePromptOptions["evaluationPriority"];
    repeatPenalty?: LLamaChatCompletePromptOptions["repeatPenalty"];
    tokenBias?: LLamaChatCompletePromptOptions["tokenBias"];
    customStopTriggers?: LLamaChatCompletePromptOptions["customStopTriggers"];
    grammar?: LLamaChatCompletePromptOptions["grammar"];
    functions?: LLamaChatCompletePromptOptions["functions"];
    documentFunctionParams?: LLamaChatCompletePromptOptions["documentFunctionParams"];
    completeAsModel?: LLamaChatCompletePromptOptions["completeAsModel"];
};
export declare const defaultMaxPreloadTokens: (sequence: LlamaContextSequence) => number;
export declare class LlamaChatSessionPromptCompletionEngine {
    private constructor();
    dispose(): void;
    /**
     * Get completion for the prompt from the cache,
     * and begin preloading this prompt into the context sequence and completing it.
     *
     * On completion progress, `onGeneration` (configured for this engine instance) will be called.
     */
    complete(prompt: string): string;
}
