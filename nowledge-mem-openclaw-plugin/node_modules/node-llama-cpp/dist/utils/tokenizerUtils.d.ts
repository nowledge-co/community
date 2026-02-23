import { LlamaVocabularyType } from "../bindings/types.js";
import type { LlamaModelTokens } from "../evaluator/LlamaModel/LlamaModel.js";
/**
 * Resolve whether a token has to be prepended at the beginning of the input, and what should it be,
 * based on the tokenizer implementation in `llama.cpp` under the `llama_tokenize_internal` function in `llama-vocab.cpp`
 */
export declare function resolveBeginningTokenToPrepend(vocabularyType: LlamaVocabularyType, tokens: LlamaModelTokens): import("../types.js").Token | null;
/**
 * Resolve whether a token has to be appended at the end of the input, and what should it be,
 * based on the tokenizer implementation in `llama.cpp` under the `llama_tokenize_internal` function in `llama-vocab.cpp`
 */
export declare function resolveEndTokenToAppend(vocabularyType: LlamaVocabularyType, tokens: LlamaModelTokens): import("../types.js").Token | null;
