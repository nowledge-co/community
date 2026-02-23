import process from "process";
import path from "path";
import { AsyncDisposeAggregator, DisposedError, EventRelay, withLock } from "lifecycle-utils";
import { removeNullFields } from "../../utils/removeNullFields.js";
import { DisposeGuard } from "../../utils/DisposeGuard.js";
import { LlamaLocks, LlamaLogLevel, LlamaVocabularyType, LlamaVocabularyTypeValues } from "../../bindings/types.js";
import { readGgufFileInfo } from "../../gguf/readGgufFileInfo.js";
import { GgufInsights } from "../../gguf/insights/GgufInsights.js";
import { getConsoleLogPrefix } from "../../utils/getConsoleLogPrefix.js";
import { getReadablePath } from "../../cli/utils/getReadablePath.js";
import { LlamaContext } from "../LlamaContext/LlamaContext.js";
import { LlamaEmbeddingContext } from "../LlamaEmbeddingContext.js";
import { GgufArchitectureType } from "../../gguf/types/GgufMetadataTypes.js";
import { maxRecentDetokenizerTokens } from "../../consts.js";
import { LlamaRankingContext } from "../LlamaRankingContext.js";
import { TokenAttribute, TokenAttributes } from "./utils/TokenAttributes.js";
const defaultUseMmap = true;
const defaultUseDirectIo = true;
const defaultContextFlashAttentionEnabled = false;
const defaultContextSwaFullCache = false;
export class LlamaModel {
    /** @internal */ _llama;
    /** @internal */ _model;
    /** @internal */ _backendModelDisposeGuard;
    /** @internal */ _tokens;
    /** @internal */ _modelPath;
    /** @internal */ _fileInfo;
    /** @internal */ _fileInsights;
    /** @internal */ _gpuLayers;
    /** @internal */ _vocabOnly;
    /** @internal */ _filename;
    /** @internal */ _disposedState = { disposed: false };
    /** @internal */ _disposeAggregator = new AsyncDisposeAggregator();
    /** @internal */ _llamaPreventDisposalHandle;
    /** @internal */ _defaultContextFlashAttentionOptionEnabled;
    /** @internal */ _defaultContextFlashAttention;
    /** @internal */ _defaultContextSwaFullCache;
    /** @internal */ _flashAttentionSupported;
    /** @internal */ _loraAdapters = new Map();
    /** @internal */ _typeDescription;
    /** @internal */ _trainContextSize;
    /** @internal */ _embeddingVectorSize;
    /** @internal */ _vocabularyType;
    tokenizer;
    onDispose = new EventRelay();
    constructor({ modelPath, gpuLayers, vocabOnly = false, useMmap, useDirectIo, useMlock, checkTensors, onLoadProgress, loadSignal, metadataOverrides }, { _llama, _fileInfo, _fileInsights, _defaultContextFlashAttentionOptionEnabled, _defaultContextFlashAttention, _defaultContextSwaFullCache, _flashAttentionSupported }) {
        this._llama = _llama;
        this._fileInfo = _fileInfo;
        this._modelPath = path.resolve(process.cwd(), modelPath);
        this._fileInsights = _fileInsights;
        this._gpuLayers = gpuLayers;
        this._vocabOnly = vocabOnly ?? false;
        this._backendModelDisposeGuard = new DisposeGuard([this._llama._backendDisposeGuard]);
        this._llamaPreventDisposalHandle = this._llama._backendDisposeGuard.createPreventDisposalHandle();
        this._defaultContextFlashAttentionOptionEnabled = _defaultContextFlashAttentionOptionEnabled;
        this._defaultContextFlashAttention = _defaultContextFlashAttention;
        this._defaultContextSwaFullCache = _defaultContextSwaFullCache;
        this._flashAttentionSupported = _flashAttentionSupported;
        const overridesList = ggufMetadataOverridesToList(metadataOverrides);
        this._model = new this._llama._bindings.AddonModel(this._modelPath, removeNullFields({
            addonExports: this._llama._bindings,
            gpuLayers,
            vocabOnly: this._vocabOnly,
            useMmap,
            useDirectIo,
            useMlock: _llama.supportsMlock
                ? useMlock
                : undefined,
            checkTensors: checkTensors ?? false,
            onLoadProgress: onLoadProgress == null
                ? undefined
                : (loadPercentage) => {
                    try {
                        onLoadProgress(loadPercentage);
                    }
                    catch (err) {
                        // the native addon code calls this function, so there's no use to throw an error here
                        console.error(err);
                    }
                },
            hasLoadAbortSignal: loadSignal != null,
            overridesList: overridesList.length > 0
                ? overridesList
                : undefined
        }));
        this._tokens = LlamaModelTokens._create(this._model, this._disposedState);
        this._filename = path.basename(modelPath);
        this._disposeAggregator.add(() => {
            this._disposedState.disposed = true;
        });
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._disposeAggregator.add(this._llama.onDispose.createListener(disposeModelIfReferenced.bind(null, new WeakRef(this))));
        this._disposeAggregator.add(async () => {
            await this._backendModelDisposeGuard.acquireDisposeLock();
            await this._model.dispose();
            this._llamaPreventDisposalHandle.dispose();
        });
        this.tokenize = this.tokenize.bind(this);
        this.detokenize = this.detokenize.bind(this);
        this.isSpecialToken = this.isSpecialToken.bind(this);
        this.isEogToken = this.isEogToken.bind(this);
        this.tokenize.detokenize = this.detokenize;
        this.tokenize.isSpecialToken = this.isSpecialToken;
        this.tokenize.isEogToken = this.isEogToken;
        Object.freeze(this.tokenize);
        this.tokenizer = this.tokenize;
    }
    async dispose() {
        if (this._disposedState.disposed)
            return;
        this._disposedState.disposed = true;
        await this._disposeAggregator.dispose();
    }
    /** @hidden */
    async [Symbol.asyncDispose]() {
        await this.dispose();
    }
    get disposed() {
        return this._disposedState.disposed;
    }
    get llama() {
        return this._llama;
    }
    get tokens() {
        return this._tokens;
    }
    get filename() {
        return this._filename;
    }
    get fileInfo() {
        return this._fileInfo;
    }
    get fileInsights() {
        return this._fileInsights;
    }
    /**
     * Number of layers offloaded to the GPU.
     * If GPU support is disabled, this will always be `0`.
     */
    get gpuLayers() {
        return this._gpuLayers;
    }
    /**
     * Total model size in memory in bytes.
     *
     * When using mmap, actual memory usage may be higher than this value due to `llama.cpp`'s performance optimizations.
     */
    get size() {
        this._ensureNotDisposed();
        return this._model.getModelSize();
    }
    get flashAttentionSupported() {
        return this._flashAttentionSupported;
    }
    get defaultContextFlashAttention() {
        return this._defaultContextFlashAttention;
    }
    get defaultContextSwaFullCache() {
        return this._defaultContextSwaFullCache;
    }
    tokenize(text, specialTokens = false, options) {
        this._ensureNotDisposed();
        if (text === "")
            return [];
        if (specialTokens === "builtin") {
            const builtinToken = text;
            switch (builtinToken) {
                case "BOS": return this.tokens.bos == null ? [] : [this.tokens.bos];
                case "EOS": return this.tokens.eos == null ? [] : [this.tokens.eos];
                case "NL": return this.tokens.nl == null ? [] : [this.tokens.nl];
                case "EOT": return this.tokens.eot == null ? [] : [this.tokens.eot];
                case "SEP": return this.tokens.sep == null ? [] : [this.tokens.sep];
            }
            void builtinToken;
            throw new Error(`Unknown builtin special token: ${builtinToken}`);
        }
        if (options === "trimLeadingSpace") {
            if (specialTokens) {
                const countLeadingSpaces = (text) => {
                    let count = 0;
                    for (; count < text.length; count++) {
                        if (text[count] !== " ")
                            break;
                    }
                    return count;
                };
                const textLeadingSpaces = countLeadingSpaces(text);
                const [workaroundToken, workaroundTokenString] = (this.tokens.bos != null && this.tokens.bosString != null)
                    ? [this.tokens.bos, this.tokens.bosString]
                    : (this.tokens.eos != null && this.tokens.eosString != null)
                        ? [this.tokens.eos, this.tokens.eosString]
                        : (this.tokens.nl != null && this.tokens.nlString != null)
                            ? [this.tokens.nl, this.tokens.nlString]
                            : (this.tokens.eot != null && this.tokens.eotString != null)
                                ? [this.tokens.eot, this.tokens.eotString]
                                : [null, null];
                if (workaroundToken != null && workaroundTokenString != null) {
                    const tokens = Array.from(this._model.tokenize(workaroundTokenString + text, true));
                    const workaroundTokenIndex = tokens.indexOf(workaroundToken);
                    // only use the tokenized output if it can be corrected, otherwise fallback to the default tokenization
                    if (workaroundTokenIndex >= 0 && workaroundTokenIndex <= 1) {
                        tokens.splice(0, workaroundTokenIndex + 1);
                        if (countLeadingSpaces(this.detokenize(tokens, true)) === textLeadingSpaces)
                            return tokens;
                    }
                }
                const workaroundTokensString = "\n";
                const workaroundTokens = Array.from(this._model.tokenize(workaroundTokensString, true));
                if (text.startsWith(workaroundTokensString)) {
                    const tokens = Array.from(this._model.tokenize(text, true));
                    if (this.detokenize(tokens, true).startsWith(workaroundTokensString))
                        return tokens;
                }
                const tokens = Array.from(this._model.tokenize(workaroundTokensString + text, true));
                // only use the tokenized output if it can be corrected, otherwise fallback to the default tokenization
                if (workaroundTokens.length > 0 && workaroundTokens.every((token, index) => tokens[index] === token)) {
                    tokens.splice(0, workaroundTokens.length);
                    if (countLeadingSpaces(this.detokenize(tokens, true)) === textLeadingSpaces)
                        return tokens;
                }
            }
            else {
                const workaroundTokensString = "\n";
                const workaroundTokens = Array.from(this._model.tokenize(workaroundTokensString, false));
                if (text.startsWith(workaroundTokensString)) {
                    const tokens = Array.from(this._model.tokenize(text, false));
                    if (this.detokenize(tokens, false).startsWith(workaroundTokensString))
                        return tokens;
                }
                const tokens = Array.from(this._model.tokenize(workaroundTokensString + text, false));
                // only use the tokenized output if it can be corrected, otherwise fallback to the default tokenization
                if (workaroundTokens.length > 0 && workaroundTokens.every((token, index) => tokens[index] === token)) {
                    tokens.splice(0, workaroundTokens.length);
                    return tokens;
                }
            }
        }
        return Array.from(this._model.tokenize(text, specialTokens));
    }
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
    detokenize(tokens, specialTokens = false, lastTokens) {
        this._ensureNotDisposed();
        if (tokens.length === 0)
            return "";
        if (lastTokens == null || lastTokens.length === 0)
            return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));
        const addedTokens = lastTokens.slice(-maxRecentDetokenizerTokens);
        const addedTokensText = this._model.detokenize(Uint32Array.from(addedTokens), Boolean(specialTokens));
        if (addedTokensText === "")
            return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));
        const text = this._model.detokenize(Uint32Array.from([...addedTokens, ...tokens]), Boolean(specialTokens));
        if (text.startsWith(addedTokensText))
            return text.slice(addedTokensText.length);
        return this._model.detokenize(Uint32Array.from(tokens), Boolean(specialTokens));
    }
    getTokenAttributes(token) {
        if (token == null)
            throw new Error("Token cannot be null");
        if (this.vocabularyType === LlamaVocabularyType.none)
            return TokenAttributes._create(token, TokenAttribute.undefined);
        return TokenAttributes._create(token, this._model.getTokenAttributes(token));
    }
    /** Check whether the given token is a special token (a control-type token or a token with no normal text representation) */
    isSpecialToken(token) {
        if (token == null)
            return false;
        if (this.getTokenAttributes(token).control)
            return true;
        const normalText = this.detokenize([token], false);
        if (normalText === "")
            return this.detokenize([token], true) !== "";
        return false;
    }
    *iterateAllTokens() {
        if (this.vocabularyType === LlamaVocabularyType.none)
            return;
        const totalTokens = this.fileInfo.metadata?.tokenizer?.ggml?.tokens?.length;
        if (typeof totalTokens !== "number")
            return;
        for (let i = 0; i < totalTokens; i++)
            yield i;
    }
    /** Check whether the given token is an EOG (End Of Generation) token, like EOS or EOT. */
    isEogToken(token) {
        if (token == null)
            return false;
        return token === this.tokens.eos || token === this.tokens.eot || this._model.isEogToken(token);
    }
    async createContext(options = {}) {
        if (this._vocabOnly)
            throw new Error("Model is loaded in vocabOnly mode, so no context can be created");
        return await withLock([this._llama._memoryLock, LlamaLocks.loadToMemory], options.createSignal, async () => {
            const preventDisposalHandle = this._backendModelDisposeGuard.createPreventDisposalHandle();
            try {
                return await LlamaContext._create(options, { _model: this });
            }
            finally {
                preventDisposalHandle.dispose();
            }
        });
    }
    /**
     * @see [Using Embedding](https://node-llama-cpp.withcat.ai/guide/embedding) tutorial
     */
    async createEmbeddingContext(options = {}) {
        if (this._vocabOnly)
            throw new Error("Model is loaded in vocabOnly mode, so no context can be created");
        return await LlamaEmbeddingContext._create({ _model: this }, options);
    }
    /**
     * @see [Reranking Documents](https://node-llama-cpp.withcat.ai/guide/embedding#reranking) tutorial
     */
    async createRankingContext(options = {}) {
        if (this._vocabOnly)
            throw new Error("Model is loaded in vocabOnly mode, so no context can be created");
        return await LlamaRankingContext._create({ _model: this }, options);
    }
    /**
     * Get warnings about the model file that would affect its usage.
     *
     * These warnings include all the warnings generated by `GgufInsights`, but are more comprehensive.
     */
    getWarnings() {
        this._ensureNotDisposed();
        const warnings = this._fileInsights.getWarnings(this._modelPath);
        const modelFilePathText = `("${getReadablePath(this._modelPath)}")`;
        try {
            const beforeTextNoSpecialTokens = "some test text here";
            const afterTextNoSpecialTokens = this.detokenize(this.tokenize(beforeTextNoSpecialTokens, false, "trimLeadingSpace"), false);
            if (beforeTextNoSpecialTokens !== afterTextNoSpecialTokens)
                warnings.push(`Using this model ${modelFilePathText} to tokenize text and then detokenize it resulted in a different text. ` +
                    "There might be an issue with the model or the tokenizer implementation. " +
                    "Using this model may not work as intended");
        }
        catch (err) {
            // do nothing
        }
        try {
            if (this._defaultContextFlashAttentionOptionEnabled && !this._flashAttentionSupported) {
                if (this.fileInfo.metadata?.general?.architecture === GgufArchitectureType.grok)
                    warnings.push("Flash attention is incompatible with Grok and thus was turned off");
                else if (this.fileInfo.metadata?.general?.architecture === GgufArchitectureType.gemma2)
                    warnings.push("Flash attention is incompatible with Gemma2 and thus was turned off");
                else {
                    const nHead = this.fileInfo.architectureMetadata?.attention?.head_count ?? 0;
                    const nEmbd = this.fileInfo.architectureMetadata?.embedding_length ?? 0;
                    const nEmbdHeadK = this.fileInfo.architectureMetadata?.attention?.key_length ?? ((nHead == 0) ? 0 : (nEmbd / nHead));
                    const nEmbdHeadV = this.fileInfo.architectureMetadata?.attention?.value_length ?? ((nHead == 0) ? 0 : nEmbd / nHead);
                    if (nEmbdHeadK !== nEmbdHeadV)
                        warnings.push("Flash attention is incompatible with this model and thus was turned off");
                }
            }
        }
        catch (err) {
            // do nothing
        }
        return warnings;
    }
    /** @hidden `ModelTypeDescription` type alias is too long in the documentation */
    get typeDescription() {
        this._ensureNotDisposed();
        if (this._typeDescription == null)
            this._typeDescription = this._model.getModelDescription();
        return this._typeDescription;
    }
    /** The context size the model was trained on */
    get trainContextSize() {
        this._ensureNotDisposed();
        if (this._trainContextSize == null)
            this._trainContextSize = this._model.getTrainContextSize();
        return this._trainContextSize;
    }
    /** The size of an embedding vector the model can produce */
    get embeddingVectorSize() {
        this._ensureNotDisposed();
        if (this._embeddingVectorSize == null)
            this._embeddingVectorSize = this._model.getEmbeddingVectorSize();
        return this._embeddingVectorSize;
    }
    get vocabularyType() {
        this._ensureNotDisposed();
        if (this._vocabularyType == null) {
            const vocabType = this._model.getVocabularyType();
            this._vocabularyType = LlamaVocabularyTypeValues[vocabType];
            if (this._vocabularyType == null) {
                console.warn(getConsoleLogPrefix() + "Unknown vocabulary type:", vocabType);
                this._vocabularyType = LlamaVocabularyType.none;
            }
        }
        return this._vocabularyType;
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
    }
    /** @internal */
    async _getOrLoadLora(filePath) {
        const resolvedPath = path.resolve(process.cwd(), filePath);
        if (this._loraAdapters.has(resolvedPath))
            return this._loraAdapters.get(resolvedPath);
        return await withLock([this._loraAdapters, "modify"], async () => {
            if (this._loraAdapters.has(resolvedPath))
                return this._loraAdapters.get(resolvedPath);
            const lora = new this._llama._bindings.AddonModelLora(this._model, resolvedPath);
            await this._model.loadLora(lora);
            this._loraAdapters.set(resolvedPath, lora);
            return lora;
        });
    }
    /** @internal */
    static async _create(modelOptions, { _llama }) {
        const { loadSignal, defaultContextFlashAttention } = modelOptions;
        const useMmap = _llama.supportsMmap && (modelOptions.useMmap ?? defaultUseMmap);
        const useDirectIo = modelOptions.useDirectIo ?? defaultUseDirectIo;
        const fileInfo = await readGgufFileInfo(modelOptions.modelPath, {
            sourceType: "filesystem",
            signal: loadSignal
        });
        applyGgufMetadataOverrides(fileInfo, modelOptions.metadataOverrides);
        const ggufInsights = await GgufInsights.from(fileInfo, _llama);
        const flashAttentionSupported = ggufInsights.flashAttentionSupported;
        const resolvedDefaultContextFlashAttention = flashAttentionSupported
            ? (defaultContextFlashAttention ?? defaultContextFlashAttentionEnabled)
            : false;
        const resolvedDefaultContextSwaFullCache = modelOptions.defaultContextSwaFullCache ?? defaultContextSwaFullCache;
        const gpuLayers = await ggufInsights.configurationResolver.resolveModelGpuLayers(modelOptions.gpuLayers, {
            ignoreMemorySafetyChecks: modelOptions.ignoreMemorySafetyChecks,
            defaultContextFlashAttention: resolvedDefaultContextFlashAttention,
            defaultContextSwaFullCache: resolvedDefaultContextSwaFullCache,
            useMmap
        });
        const resourceRequirementsEstimation = ggufInsights.estimateModelResourceRequirements({
            gpuLayers: gpuLayers,
            useMmap
        });
        const model = new LlamaModel({ ...modelOptions, gpuLayers, useMmap, useDirectIo }, {
            _fileInfo: fileInfo,
            _fileInsights: ggufInsights,
            _llama,
            _defaultContextFlashAttentionOptionEnabled: defaultContextFlashAttention ?? false,
            _flashAttentionSupported: flashAttentionSupported,
            _defaultContextFlashAttention: resolvedDefaultContextFlashAttention,
            _defaultContextSwaFullCache: resolvedDefaultContextSwaFullCache
        });
        const modelCreationVramReservation = modelOptions.ignoreMemorySafetyChecks
            ? null
            : _llama._vramOrchestrator.reserveMemory(resourceRequirementsEstimation.gpuVram);
        const modelCreationRamReservation = modelOptions.ignoreMemorySafetyChecks
            ? null
            : _llama._ramOrchestrator.reserveMemory(resourceRequirementsEstimation.cpuRam);
        const loggedWarnings = new Set();
        function onAbort() {
            model._model.abortActiveModelLoad();
            loadSignal?.removeEventListener("abort", onAbort);
        }
        function logWarnings(warnings) {
            for (const warning of warnings) {
                if (loggedWarnings.has(warning))
                    continue;
                _llama._log(LlamaLogLevel.warn, warning);
                loggedWarnings.add(warning);
            }
        }
        if (loadSignal != null) {
            if (loadSignal.aborted)
                throw loadSignal.reason;
            loadSignal.addEventListener("abort", onAbort);
        }
        logWarnings(ggufInsights.getWarnings(modelOptions.modelPath));
        try {
            const modelLoaded = await model._model.init();
            if (loadSignal?.aborted) {
                if (modelLoaded)
                    await model._model.dispose();
                throw loadSignal.reason;
            }
            else if (!modelLoaded)
                throw new Error("Failed to load model");
            loadSignal?.removeEventListener("abort", onAbort);
            logWarnings(model.getWarnings());
            return model;
        }
        finally {
            loadSignal?.removeEventListener("abort", onAbort);
            modelCreationVramReservation?.dispose?.();
            modelCreationRamReservation?.dispose?.();
        }
    }
}
export class LlamaModelTokens {
    /** @internal */ _model;
    /** @internal */ _disposedState;
    /** @internal */ _infillTokens;
    /** @internal */ _bosToken;
    /** @internal */ _eosToken;
    /** @internal */ _eotToken;
    /** @internal */ _sepToken;
    /** @internal */ _nlToken;
    /** @internal */ _bosString;
    /** @internal */ _eosString;
    /** @internal */ _eotString;
    /** @internal */ _sepString;
    /** @internal */ _nlString;
    /** @internal */ _shouldPrependBosToken;
    /** @internal */ _shouldAppendEosToken;
    constructor(model, disposedState) {
        this._model = model;
        this._disposedState = disposedState;
    }
    /**
     * @returns infill tokens
     */
    get infill() {
        this._ensureNotDisposed();
        if (this._infillTokens == null)
            this._infillTokens = LlamaModelInfillTokens._create(this._model, this._disposedState);
        return this._infillTokens;
    }
    /**
     * @returns The BOS (Beginning Of Sequence) token.
     */
    get bos() {
        this._ensureNotDisposed();
        if (this._bosToken == null)
            this._bosToken = this._model.tokenBos();
        if (this._bosToken === -1)
            return null;
        return this._bosToken;
    }
    /**
     * @returns The EOS (End Of Sequence) token.
     */
    get eos() {
        this._ensureNotDisposed();
        if (this._eosToken == null)
            this._eosToken = this._model.tokenEos();
        if (this._eosToken === -1)
            return null;
        return this._eosToken;
    }
    /**
     * @returns The EOT (End Of Turn) token.
     */
    get eot() {
        this._ensureNotDisposed();
        if (this._eotToken == null)
            this._eotToken = this._model.eotToken();
        if (this._eotToken === -1)
            return null;
        return this._eotToken;
    }
    /**
     * @returns The SEP (Sentence Separator) token.
     */
    get sep() {
        this._ensureNotDisposed();
        if (this._sepToken == null)
            this._sepToken = this._model.sepToken();
        if (this._sepToken === -1)
            return null;
        return this._sepToken;
    }
    /**
     * @returns The NL (New Line) token.
     */
    get nl() {
        this._ensureNotDisposed();
        if (this._nlToken == null)
            this._nlToken = this._model.tokenNl();
        if (this._nlToken === -1)
            return null;
        return this._nlToken;
    }
    /**
     * @returns The BOS (Beginning Of Sequence) token text representation.
     */
    get bosString() {
        this._ensureNotDisposed();
        const bosToken = this.bos;
        if (bosToken == null)
            return null;
        if (this._bosString == null)
            this._bosString = this._model.getTokenString(bosToken);
        return this._bosString;
    }
    /**
     * @returns The EOS (End Of Sequence) token text representation.
     */
    get eosString() {
        this._ensureNotDisposed();
        const eosToken = this.eos;
        if (eosToken == null)
            return null;
        if (this._eosString == null)
            this._eosString = this._model.getTokenString(eosToken);
        return this._eosString;
    }
    /**
     * @returns The EOT (End Of Turn) token text representation.
     */
    get eotString() {
        this._ensureNotDisposed();
        const eotToken = this.eot;
        if (eotToken == null)
            return null;
        if (this._eotString == null)
            this._eotString = this._model.getTokenString(eotToken);
        return this._eotString;
    }
    /**
     * @returns The SEP (Sentence Separator) token text representation.
     */
    get sepString() {
        this._ensureNotDisposed();
        const sepToken = this.sep;
        if (sepToken == null)
            return null;
        if (this._sepString == null)
            this._sepString = this._model.getTokenString(sepToken);
        return this._sepString;
    }
    /**
     * @returns The NL (New Line) token text representation.
     */
    get nlString() {
        this._ensureNotDisposed();
        const nlToken = this.nl;
        if (nlToken == null)
            return null;
        if (this._nlString == null)
            this._nlString = this._model.getTokenString(nlToken);
        return this._nlString;
    }
    /**
     * @returns Whether we should prepend a BOS (Beginning Of Sequence) token for evaluations with this model.
     */
    get shouldPrependBosToken() {
        this._ensureNotDisposed();
        if (this._shouldPrependBosToken == null)
            this._shouldPrependBosToken = this.bos != null && this._model.shouldPrependBosToken();
        return this._shouldPrependBosToken;
    }
    /**
     * @returns Whether we should append an EOS (End Of Sequence) token for evaluations with this model.
     */
    get shouldAppendEosToken() {
        this._ensureNotDisposed();
        if (this._shouldAppendEosToken == null)
            this._shouldAppendEosToken = this.bos != null && this._model.shouldAppendEosToken();
        return this._shouldAppendEosToken;
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
    }
    /** @internal */
    static _create(model, disposedState) {
        return new LlamaModelTokens(model, disposedState);
    }
}
export class LlamaModelInfillTokens {
    /** @internal */ _model;
    /** @internal */ _disposedState;
    /** @internal */ _prefixToken;
    /** @internal */ _middleToken;
    /** @internal */ _suffixToken;
    /** @internal */ _prefixString;
    /** @internal */ _middleString;
    /** @internal */ _suffixString;
    constructor(model, disposedState) {
        this._model = model;
        this._disposedState = disposedState;
    }
    /**
     * @returns The beginning of infill prefix token.
     */
    get prefix() {
        this._ensureNotDisposed();
        if (this._prefixToken == null)
            this._prefixToken = this._resolveSpecialToken(this._model.prefixToken(), ["<fim_prefix>"]);
        if (this._prefixToken === -1)
            return null;
        return this._prefixToken;
    }
    /**
     * @returns The beginning of infill middle token.
     */
    get middle() {
        this._ensureNotDisposed();
        if (this._middleToken == null)
            this._middleToken = this._resolveSpecialToken(this._model.middleToken(), ["<fim_middle>"]);
        if (this._middleToken === -1)
            return null;
        return this._middleToken;
    }
    /**
     * @returns The beginning of infill suffix token.
     */
    get suffix() {
        this._ensureNotDisposed();
        if (this._suffixToken == null)
            this._suffixToken = this._resolveSpecialToken(this._model.suffixToken(), ["<fim_suffix>"]);
        if (this._suffixToken === -1)
            return null;
        return this._suffixToken;
    }
    /**
     * @returns The beginning of infill prefix token as a string.
     */
    get prefixString() {
        this._ensureNotDisposed();
        const prefixToken = this.prefix;
        if (prefixToken == null)
            return null;
        if (this._prefixString == null)
            this._prefixString = this._model.getTokenString(prefixToken);
        return this._prefixString;
    }
    /**
     * @returns The beginning of infill middle token as a string.
     */
    get middleString() {
        this._ensureNotDisposed();
        const middleToken = this.middle;
        if (middleToken == null)
            return null;
        if (this._middleString == null)
            this._middleString = this._model.getTokenString(middleToken);
        return this._middleString;
    }
    /**
     * @returns The beginning of infill suffix token as a string.
     */
    get suffixString() {
        this._ensureNotDisposed();
        const suffixToken = this.suffix;
        if (suffixToken == null)
            return null;
        if (this._suffixString == null)
            this._suffixString = this._model.getTokenString(suffixToken);
        return this._suffixString;
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this._disposedState.disposed)
            throw new DisposedError();
    }
    /** @internal */
    _resolveSpecialToken(token, fallbackTexts) {
        if (token != null && token !== -1)
            return token;
        for (const text of fallbackTexts) {
            const tokens = this._model.tokenize(text, true);
            if (tokens.length !== 1)
                continue;
            return tokens[0];
        }
        return -1;
    }
    /** @internal */
    static _create(model, disposedState) {
        return new LlamaModelInfillTokens(model, disposedState);
    }
}
function applyGgufMetadataOverrides(ggufFileInfo, overrides) {
    function applyOverride(object, override) {
        if (override == null || object == null)
            return;
        if (object instanceof Array || typeof object !== "object" || typeof override !== "object")
            return;
        for (const [key, value] of Object.entries(override)) {
            if (value instanceof Array || typeof value !== "object" || (typeof value === "object" && typeof object[key] !== "object"))
                object[key] = value;
            else
                applyOverride(object[key], value);
        }
    }
    applyOverride(ggufFileInfo.metadata, overrides);
}
function ggufMetadataOverridesToList(overrides) {
    const maxStringLength = 127;
    const maxKeyLength = 127;
    const res = [];
    function addItem(object, path) {
        if (object == null || object instanceof Array)
            return;
        if (typeof object !== "object") {
            if (typeof object === "string" && object.length > maxStringLength)
                throw new Error(`Metadata key "${path.join(".")}" override string value (${JSON.stringify(object)}) is longer than ${maxStringLength} characters`);
            const key = path.join(".");
            if (key.length > maxKeyLength)
                throw new Error(`Metadata key "${key}" override path is longer than ${maxKeyLength} characters`);
            let type = undefined;
            if (typeof object === "number") {
                if (typeof object === "bigint" || Number.isInteger(object))
                    type = 0;
                else
                    type = 1;
            }
            res.push([key, object, type]);
            return;
        }
        for (const [key, value] of Object.entries(object))
            addItem(value, [...path, key]);
    }
    addItem(overrides ?? {}, []);
    return res;
}
function disposeModelIfReferenced(modelRef) {
    const model = modelRef.deref();
    if (model != null)
        void model.dispose();
}
//# sourceMappingURL=LlamaModel.js.map