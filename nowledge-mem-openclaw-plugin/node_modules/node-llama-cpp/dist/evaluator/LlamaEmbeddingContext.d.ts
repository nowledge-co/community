import { EventRelay } from "lifecycle-utils";
import { Token } from "../types.js";
import { LlamaText } from "../utils/LlamaText.js";
import { LlamaEmbedding } from "./LlamaEmbedding.js";
import type { LlamaModel } from "./LlamaModel/LlamaModel.js";
export type LlamaEmbeddingContextOptions = {
    /**
     * The number of tokens the model can see at once.
     * - **`"auto"`** - adapt to the current VRAM state and attemp to set the context size as high as possible up to the size
     * the model was trained on.
     * - **`number`** - set the context size to a specific number of tokens.
     * If there's not enough VRAM, an error will be thrown.
     * Use with caution.
     * - **`{min?: number, max?: number}`** - adapt to the current VRAM state and attemp to set the context size as high as possible
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
     * Ignore insufficient memory errors and continue with the context creation.
     * Can cause the process to crash if there's not enough VRAM for the new context.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean;
};
/**
 * @see [Using Embedding](https://node-llama-cpp.withcat.ai/guide/embedding) tutorial
 */
export declare class LlamaEmbeddingContext {
    readonly onDispose: EventRelay<void>;
    private constructor();
    getEmbeddingFor(input: Token[] | string | LlamaText): Promise<LlamaEmbedding>;
    dispose(): Promise<void>;
    /** @hidden */
    [Symbol.asyncDispose](): Promise<void>;
    get disposed(): boolean;
    get model(): LlamaModel;
}
