import { EventRelay } from "lifecycle-utils";
import { Token } from "../types.js";
import { LlamaText } from "../utils/LlamaText.js";
import type { LlamaModel } from "./LlamaModel/LlamaModel.js";
export type LlamaRankingContextOptions = {
    /**
     * The number of tokens the model can see at once.
     * - **`"auto"`** - adapt to the current VRAM state and attempt to set the context size as high as possible up to the size
     * the model was trained on.
     * - **`number`** - set the context size to a specific number of tokens.
     * If there's not enough VRAM, an error will be thrown.
     * Use with caution.
     * - **`{min?: number, max?: number}`** - adapt to the current VRAM state and attempt to set the context size as high as possible
     * up to the size the model was trained on, but at least `min` and at most `max`.
     *
     * Defaults to `"auto"`.
     */
    contextSize?: "auto" | number | {
        min?: number;
        max?: number;
    };
    /** prompt processing batch size */
    batchSize?: number;
    /**
     * number of threads to use to evaluate tokens.
     * set to 0 to use the maximum threads supported by the current machine hardware
     */
    threads?: number;
    /** An abort signal to abort the context creation */
    createSignal?: AbortSignal;
    /**
     * The template to use for the ranking evaluation.
     * If not provided, the model's template will be used by default.
     *
     * The template is tokenized with special tokens enabled, but the provided query and document are not.
     *
     * **<span v-pre>`{{query}}`</span>** is replaced with the query content.
     *
     * **<span v-pre>`{{document}}`</span>** is replaced with the document content.
     *
     * It's recommended to not set this option unless you know what you're doing.
     *
     * Defaults to the model's template.
     */
    template?: `${string}{{query}}${string}{{document}}${string}` | `${string}{{document}}${string}{{query}}${string}`;
    /**
     * Ignore insufficient memory errors and continue with the context creation.
     * Can cause the process to crash if there's not enough VRAM for the new context.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean;
};
/**
 * @see [Reranking Documents](https://node-llama-cpp.withcat.ai/guide/embedding#reranking) tutorial
 */
export declare class LlamaRankingContext {
    readonly onDispose: EventRelay<void>;
    private constructor();
    /**
     * Get the ranking score for a document for a query.
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     * @returns a ranking score between 0 and 1 representing the probability that the document is relevant to the query.
     */
    rank(query: Token[] | string | LlamaText, document: Token[] | string | LlamaText): Promise<number>;
    /**
     * Get the ranking scores for all the given documents for a query.
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     * @returns an array of ranking scores between 0 and 1 representing the probability that the document is relevant to the query.
     */
    rankAll(query: Token[] | string | LlamaText, documents: Array<Token[] | string | LlamaText>): Promise<number[]>;
    /**
     * Get the ranking scores for all the given documents for a query and sort them by score from highest to lowest.
     *
     * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
     */
    rankAndSort<const T extends string>(query: Token[] | string | LlamaText, documents: T[]): Promise<Array<{
        document: T;
        /**
         * A ranking score is a number between 0 and 1 representing the probability that the document is relevant to the query.
         */
        score: number;
    }>>;
    dispose(): Promise<void>;
    /** @hidden */
    [Symbol.asyncDispose](): Promise<void>;
    get disposed(): boolean;
    get model(): LlamaModel;
}
