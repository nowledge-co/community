import { LlamaContextSequence } from "../LlamaContext/LlamaContext.js";
import { Token, Tokenizer } from "../../types.js";
import { LlamaText } from "../../utils/LlamaText.js";
/**
 * Chunk the given document using a given context sequence to use the chunks for RAG (Retrieval Augmented Generation) embeddings.
 *
 * This chunking method is fast and efficient, and utilizes as much parallelization as your hardware allows.
 *
 * Based on https://github.com/ZeroEntropy-AI/llama-chunk
 * @experimental - this API is experimental and may change or be removed in subsequent releases
 * @hidden
 */
export declare function experimentalChunkDocument(options: {
    contextSequence: LlamaContextSequence;
    document: string;
    /**
     * The tokens to use as separators for chunking the document.
     * Passed to the `getSystemPrompt` function to generate the prompt.
     */
    separatorTokens?: Token[];
    getSystemPrompt?(options: {
        separatorTokens: Token[];
        tokenizer: Tokenizer;
        maxChunkSize?: number;
    }): LlamaText | string;
    /**
     * Maximum number of tokens to allow in a chunk.
     *
     * As a chunk size approaches this limit, the higher the probability of a separator token being inserted.
     *
     * Set to `0` to disable this mechanism.
     *
     * Defaults to `500`.
     */
    maxChunkSize?: number;
    /**
     * The alignment curve for the maximum chunk size mechanism.
     *
     * Adjust the value based on the behavior of the model.
     *
     * Play around with values between `1` and `4` to see what works best for you.
     *
     * Set to `1` to disable this mechanism.
     *
     * Defaults to `4`.
     */
    maxChunkSizeAlignmentCurve?: number;
    /**
     * Append the next few tokens (up to `maxTokens`) to the current chunk if their trimmed content
     * matches any of the texts in `trimmedTexts`
     */
    syntaxAlignment?: {
        /**
         * The maximum number of tokens to append to the current chunk if their trimmed content matches any of the texts in `trimmedTexts`.
         *
         * Default: `4`
         */
        maxTokens?: number;
        /**
         * The trimmed texts to match for, to append the token to the current chunk.
         *
         * Default: `["", ".", ";"]`
         */
        trimmedTexts?: string[];
    };
    /**
     * The number of tokens to skip before starting to use the generated separator tokens to split the document.
     */
    skipFirstTokens?: number;
    /**
     * The number of recent probabilities to keep in the trail for normalization.
     *
     * Adjust the value based on the behavior of the model.
     *
     * Defaults to `200`.
     */
    normalizationTrailSize?: number;
    /**
     * Called when a chunk is generated with the tokens that make up the chunk and the separator token used to split the chunk.
     */
    onChunkTokens?(chunkTokens: Token[], usedSeparatorToken: Token): void;
    /**
     * Called when a chunk is generated with the text that makes up the chunk and the separator token used to split the chunk.
     */
    onChunkText?(chunkText: string, usedSeparatorToken: Token): void;
}): Promise<string[]>;
