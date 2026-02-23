import { EventRelay } from "lifecycle-utils";
import { Token, Tokenizer } from "../../types.js";
import { ModelTypeDescription } from "../../bindings/AddonTypes.js";
import { LlamaVocabularyType } from "../../bindings/types.js";
import { GgufFileInfo } from "../../gguf/types/GgufFileInfoTypes.js";
import { GgufInsights } from "../../gguf/insights/GgufInsights.js";
import { LlamaContextOptions } from "../LlamaContext/types.js";
import { LlamaContext } from "../LlamaContext/LlamaContext.js";
import { LlamaEmbeddingContext, LlamaEmbeddingContextOptions } from "../LlamaEmbeddingContext.js";
import { GgufMetadata } from "../../gguf/types/GgufMetadataTypes.js";
import { OverridesObject } from "../../utils/OverridesObject.js";
import { LlamaRankingContext, LlamaRankingContextOptions } from "../LlamaRankingContext.js";
import { TokenAttributes } from "./utils/TokenAttributes.js";
import type { Llama } from "../../bindings/Llama.js";
import type { BuiltinSpecialTokenValue } from "../../utils/LlamaText.js";
export type LlamaModelOptions = {
    /** path to the model on the filesystem */
    modelPath: string;
    /**
     * Number of layers to store in VRAM.
     * - **`"auto"`** - adapt to the current VRAM state and try to fit as many layers as possible in it.
     * Takes into account the VRAM required to create a context with a `contextSize` set to `"auto"`.
     * - **`"max"`** - store all layers in VRAM. If there's not enough VRAM, an error will be thrown. Use with caution.
     * - **`number`** - store the specified number of layers in VRAM. If there's not enough VRAM, an error will be thrown. Use with caution.
     * - **`{min?: number, max?: number, fitContext?: {contextSize: number}}`** - adapt to the current VRAM state and try to fit as
     * many layers as possible in it, but at least `min` and at most `max` layers. Set `fitContext` to the parameters of a context you
     * intend to create with the model, so it'll take it into account in the calculations and leave enough memory for such a context.
     *
     * If GPU support is disabled, will be set to `0` automatically.
     *
     * Defaults to `"auto"`.
     */
    gpuLayers?: "auto" | "max" | number | {
        min?: number;
        max?: number;
        fitContext?: {
            contextSize?: number;
            /**
             * Defaults to `false`.
             */
            embeddingContext?: boolean;
        };
    };
    /**
     * Only load the vocabulary, not weight tensors.
     *
     * Useful when you only want to use the model to use its tokenizer but not for evaluation.
     *
     * Defaults to `false`.
     */
    vocabOnly?: boolean;
    /**
     * Use mmap (memory-mapped file) to load the model.
     *
     * Using mmap allows the OS to load the model tensors directly from the file on the filesystem,
     * and makes it easier for the system to manage memory.
     *
     * When using mmap, you might notice a delay the first time you actually use the model,
     * which is caused by the OS itself loading the model into memory.
     *
     * Defaults to `true` if the current system supports it.
     */
    useMmap?: boolean;
    /**
     * Direct I/O is a method of reading and writing data to and from the storage device directly to the application memory,
     * bypassing OS in-memory caches.
     *
     * It leads to improved model loading times and reduced RAM usage,
     * on the expense of higher loading times when the model unloaded and loaded again repeatedly in a short period of time.
     *
     * When this option is enabled, if Direct I/O is supported by the system (and for the given file)
     * it will be used and mmap will be disabled.
     *
     * Unsupported on macOS.
     *
     * Defaults to `true`.
     */
    useDirectIo?: boolean;
    /**
     * Force the system to keep the model in the RAM/VRAM.
     * Use with caution as this can crash your system if the available resources are insufficient.
     */
    useMlock?: boolean;
    /**
     * Check for tensor validity before actually loading the model.
     * Using it increases the time it takes to load the model.
     *
     * Defaults to `false`.
     */
    checkTensors?: boolean;
    /**
     * Enable flash attention by default for contexts created with this model.
     * Only works with models that support flash attention.
     *
     * Flash attention is an optimization in the attention mechanism that makes inference faster, more efficient and uses less memory.
     *
     * The support for flash attention is currently experimental and may not always work as expected.
     * Use with caution.
     *
     * This option will be ignored if flash attention is not supported by the model.
     *
     * Enabling this affects the calculations of default values for the model and contexts created with it
     * as flash attention reduces the amount of memory required,
     * which allows for more layers to be offloaded to the GPU and for context sizes to be bigger.
     *
     * Defaults to `false`.
     *
     * Upon flash attention exiting the experimental status, the default value will become `true`.
     */
    defaultContextFlashAttention?: boolean;
    /**
     * When using SWA (Sliding Window Attention) on a supported model,
     * extend the sliding window size to the current context size (meaning practically disabling SWA)
     * by default for contexts created with this model.
     *
     * See the `swaFullCache` option of the `.createContext()` method for more information.
     *
     * Defaults to `false`.
     */
    defaultContextSwaFullCache?: boolean;
    /**
     * Called with the load percentage when the model is being loaded.
     * @param loadProgress - a number between 0 (exclusive) and 1 (inclusive).
     */
    onLoadProgress?(loadProgress: number): void;
    /** An abort signal to abort the model load */
    loadSignal?: AbortSignal;
    /**
     * Ignore insufficient memory errors and continue with the model load.
     * Can cause the process to crash if there's not enough VRAM to fit the model.
     *
     * Defaults to `false`.
     */
    ignoreMemorySafetyChecks?: boolean;
    /**
     * Metadata overrides to load the model with.
     *
     * > **Note:** Most metadata value overrides aren't supported and overriding them will have no effect on `llama.cpp`.
     * > Only use this for metadata values that are explicitly documented to be supported by `llama.cpp` to be overridden,
     * > and only in cases when this is crucial, as this is not guaranteed to always work as expected.
     */
    metadataOverrides?: OverridesObject<GgufMetadata, number | bigint | boolean | string>;
};
export declare class LlamaModel {
    readonly tokenizer: Tokenizer;
    readonly onDispose: EventRelay<void>;
    private constructor();
    dispose(): Promise<void>;
    /** @hidden */
    [Symbol.asyncDispose](): Promise<void>;
    get disposed(): boolean;
    get llama(): Llama;
    get tokens(): LlamaModelTokens;
    get filename(): string | undefined;
    get fileInfo(): GgufFileInfo;
    get fileInsights(): GgufInsights;
    /**
     * Number of layers offloaded to the GPU.
     * If GPU support is disabled, this will always be `0`.
     */
    get gpuLayers(): number;
    /**
     * Total model size in memory in bytes.
     *
     * When using mmap, actual memory usage may be higher than this value due to `llama.cpp`'s performance optimizations.
     */
    get size(): number;
    get flashAttentionSupported(): boolean;
    get defaultContextFlashAttention(): boolean;
    get defaultContextSwaFullCache(): boolean;
    /**
     * Transform text into tokens that can be fed to the model
     * @param text - the text to tokenize
     * @param [specialTokens] - if set to true, text that correspond to special tokens will be tokenized to those tokens.
     * For example, `<s>` will be tokenized to the BOS token if `specialTokens` is set to `true`,
     * otherwise it will be tokenized to tokens that corresponds to the plaintext `<s>` string.
     * @param [options] - additional options for tokenization.
     * If set to `"trimLeadingSpace"`, a leading space will be trimmed from the tokenized output if the output has an
     * additional space at the beginning.
     */
    tokenize(text: string, specialTokens?: boolean, options?: "trimLeadingSpace"): Token[];
    tokenize(text: BuiltinSpecialTokenValue, specialTokens: "builtin"): Token[];
    /**
     * Transform tokens into text
     * @param tokens - the tokens to detokenize.
     * @param [specialTokens] - if set to `true`, special tokens will be detokenized to their corresponding token text representation.
     *
     * Recommended for debugging purposes only.
     *
     * > **Note:** there may be additional spaces around special tokens that were not present in the original text - this is not a bug,
     * this is [how the tokenizer is supposed to work](https://github.com/ggml-org/llama.cpp/pull/7697#issuecomment-2144003246).
     *
     * Defaults to `false`.
     * @param [lastTokens] - the last few tokens that preceded the tokens to detokenize.
     * If provided, the last few tokens will be used to determine whether a space has to be added before the current tokens or not,
     * and apply other detokenizer-specific heuristics to provide the correct text continuation to the existing tokens.
     *
     * Using it may have no effect with some models, but it is still recommended.
     */
    detokenize(tokens: readonly Token[], specialTokens?: boolean, lastTokens?: readonly Token[]): string;
    getTokenAttributes(token: Token): TokenAttributes;
    /** Check whether the given token is a special token (a control-type token or a token with no normal text representation) */
    isSpecialToken(token: Token | undefined): boolean;
    iterateAllTokens(): Generator<Token, void, unknown>;
    /** Check whether the given token is an EOG (End Of Generation) token, like EOS or EOT. */
    isEogToken(token: Token | undefined): boolean;
    createContext(options?: LlamaContextOptions): Promise<LlamaContext>;
    /**
     * @see [Using Embedding](https://node-llama-cpp.withcat.ai/guide/embedding) tutorial
     */
    createEmbeddingContext(options?: LlamaEmbeddingContextOptions): Promise<LlamaEmbeddingContext>;
    /**
     * @see [Reranking Documents](https://node-llama-cpp.withcat.ai/guide/embedding#reranking) tutorial
     */
    createRankingContext(options?: LlamaRankingContextOptions): Promise<LlamaRankingContext>;
    /**
     * Get warnings about the model file that would affect its usage.
     *
     * These warnings include all the warnings generated by `GgufInsights`, but are more comprehensive.
     */
    getWarnings(): string[];
    /** @hidden `ModelTypeDescription` type alias is too long in the documentation */
    get typeDescription(): ModelTypeDescription;
    /** The context size the model was trained on */
    get trainContextSize(): number;
    /** The size of an embedding vector the model can produce */
    get embeddingVectorSize(): number;
    get vocabularyType(): LlamaVocabularyType;
}
export declare class LlamaModelTokens {
    private constructor();
    /**
     * @returns infill tokens
     */
    get infill(): LlamaModelInfillTokens;
    /**
     * @returns The BOS (Beginning Of Sequence) token.
     */
    get bos(): Token | null;
    /**
     * @returns The EOS (End Of Sequence) token.
     */
    get eos(): Token | null;
    /**
     * @returns The EOT (End Of Turn) token.
     */
    get eot(): Token | null;
    /**
     * @returns The SEP (Sentence Separator) token.
     */
    get sep(): Token | null;
    /**
     * @returns The NL (New Line) token.
     */
    get nl(): Token | null;
    /**
     * @returns The BOS (Beginning Of Sequence) token text representation.
     */
    get bosString(): string | null;
    /**
     * @returns The EOS (End Of Sequence) token text representation.
     */
    get eosString(): string | null;
    /**
     * @returns The EOT (End Of Turn) token text representation.
     */
    get eotString(): string | null;
    /**
     * @returns The SEP (Sentence Separator) token text representation.
     */
    get sepString(): string | null;
    /**
     * @returns The NL (New Line) token text representation.
     */
    get nlString(): string | null;
    /**
     * @returns Whether we should prepend a BOS (Beginning Of Sequence) token for evaluations with this model.
     */
    get shouldPrependBosToken(): boolean;
    /**
     * @returns Whether we should append an EOS (End Of Sequence) token for evaluations with this model.
     */
    get shouldAppendEosToken(): boolean;
}
export declare class LlamaModelInfillTokens {
    private constructor();
    /**
     * @returns The beginning of infill prefix token.
     */
    get prefix(): Token | null;
    /**
     * @returns The beginning of infill middle token.
     */
    get middle(): Token | null;
    /**
     * @returns The beginning of infill suffix token.
     */
    get suffix(): Token | null;
    /**
     * @returns The beginning of infill prefix token as a string.
     */
    get prefixString(): string | null;
    /**
     * @returns The beginning of infill middle token as a string.
     */
    get middleString(): string | null;
    /**
     * @returns The beginning of infill suffix token as a string.
     */
    get suffixString(): string | null;
}
