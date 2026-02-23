import { DisposeAggregator, DisposedError, EventRelay, withLock } from "lifecycle-utils";
import { appendUserMessageToChatHistory } from "../../utils/appendUserMessageToChatHistory.js";
import { LlamaChat } from "../LlamaChat/LlamaChat.js";
import { wrapAbortSignal } from "../../utils/wrapAbortSignal.js";
import { safeEventCallback } from "../../utils/safeEventCallback.js";
import { GgufArchitectureType } from "../../gguf/types/GgufMetadataTypes.js";
import { LlamaChatSessionPromptCompletionEngine } from "./utils/LlamaChatSessionPromptCompletionEngine.js";
const defaultCompleteAsModel = {
    enabled: "auto",
    appendedMessages: [
        {
            type: "system",
            text: "For your next response predict what the user may send next. No yapping, no whitespace. Match the user's language and tone."
        },
        { type: "user", text: "" },
        { type: "model", response: [""] }
    ]
};
/**
 * @see [Using `LlamaChatSession`](https://node-llama-cpp.withcat.ai/guide/chat-session) tutorial
 */
export class LlamaChatSession {
    /** @internal */ _disposeAggregator = new DisposeAggregator();
    /** @internal */ _autoDisposeSequence;
    /** @internal */ _contextShift;
    /** @internal */ _forceAddSystemPrompt;
    /** @internal */ _systemPrompt;
    /** @internal */ _chatLock = {};
    /** @internal */ _chatHistory;
    /** @internal */ _lastEvaluation;
    /** @internal */ _canUseContextWindowForCompletion = true;
    /** @internal */ _chat;
    /** @internal */ _chatHistoryStateRef = {};
    /** @internal */ _preloadAndCompleteAbortControllers = new Set();
    onDispose = new EventRelay();
    constructor(options) {
        const { contextSequence, chatWrapper = "auto", systemPrompt, forceAddSystemPrompt = false, autoDisposeSequence = false, contextShift } = options;
        if (contextSequence == null)
            throw new Error("contextSequence cannot be null");
        if (contextSequence.disposed)
            throw new DisposedError();
        this._contextShift = contextShift;
        this._forceAddSystemPrompt = forceAddSystemPrompt;
        this._systemPrompt = systemPrompt;
        this._chat = new LlamaChat({
            autoDisposeSequence,
            chatWrapper,
            contextSequence
        });
        const chatWrapperSupportsSystemMessages = this._chat.chatWrapper.settings.supportsSystemMessages;
        if (chatWrapperSupportsSystemMessages == null || chatWrapperSupportsSystemMessages || this._forceAddSystemPrompt)
            this._chatHistory = this._chat.chatWrapper.generateInitialChatHistory({ systemPrompt: this._systemPrompt });
        else
            this._chatHistory = [];
        this._autoDisposeSequence = autoDisposeSequence;
        this._disposeAggregator.add(this._chat.onDispose.createListener(() => {
            this.dispose();
        }));
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
    }
    dispose({ disposeSequence = this._autoDisposeSequence } = {}) {
        if (this._chat == null)
            return;
        this._chat.dispose({ disposeSequence });
        this._chat = null;
        this._disposeAggregator.dispose();
    }
    /** @hidden */
    [Symbol.dispose]() {
        return this.dispose();
    }
    get disposed() {
        return this._chat == null || this._chat.disposed;
    }
    get chatWrapper() {
        if (this._chat == null)
            throw new DisposedError();
        return this._chat.chatWrapper;
    }
    get sequence() {
        if (this._chat == null)
            throw new DisposedError();
        return this._chat.sequence;
    }
    get context() {
        return this.sequence.context;
    }
    get model() {
        return this.sequence.model;
    }
    async prompt(prompt, options = {}) {
        const { functions, documentFunctionParams, maxParallelFunctionCalls, onTextChunk, onToken, onResponseChunk, onFunctionCallParamsChunk, budgets, signal, stopOnAbortSignal = false, maxTokens, temperature, minP, topK, topP, seed, grammar, trimWhitespaceSuffix = false, responsePrefix, repeatPenalty, tokenBias, customStopTriggers } = options;
        const { responseText } = await this.promptWithMeta(prompt, {
            // this is a workaround to allow passing both `functions` and `grammar`
            functions: functions,
            grammar: grammar,
            documentFunctionParams: documentFunctionParams,
            maxParallelFunctionCalls: maxParallelFunctionCalls,
            onFunctionCallParamsChunk: onFunctionCallParamsChunk,
            onTextChunk, onToken, onResponseChunk, budgets, signal, stopOnAbortSignal, maxTokens,
            temperature, minP, topK, topP, seed,
            trimWhitespaceSuffix, responsePrefix, repeatPenalty, tokenBias, customStopTriggers
        });
        return responseText;
    }
    /**
     * @param prompt
     * @param [options]
     */
    async promptWithMeta(prompt, { functions, documentFunctionParams, maxParallelFunctionCalls, onTextChunk, onToken, onResponseChunk, onFunctionCallParamsChunk, budgets, signal, stopOnAbortSignal = false, maxTokens, temperature, minP, topK, topP, seed, grammar, trimWhitespaceSuffix = false, responsePrefix, repeatPenalty, tokenBias, customStopTriggers, evaluationPriority } = {}) {
        this._ensureNotDisposed();
        if (grammar != null && grammar._llama !== this.model._llama)
            throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");
        this._stopAllPreloadAndPromptCompletions();
        return await withLock([this._chatLock, "evaluation"], signal, async () => {
            this._ensureNotDisposed();
            this._stopAllPreloadAndPromptCompletions();
            if (this._chat == null)
                throw new DisposedError();
            const supportsParallelFunctionCalling = this._chat.chatWrapper.settings.functions.parallelism != null;
            const [abortController, disposeAbortController] = wrapAbortSignal(signal);
            let lastEvaluation = this._canUseContextWindowForCompletion
                ? this._lastEvaluation
                : undefined;
            let newChatHistory = appendUserMessageToChatHistory(this._chatHistory, prompt);
            let newContextWindowChatHistory = lastEvaluation?.contextWindow == null
                ? undefined
                : appendUserMessageToChatHistory(lastEvaluation?.contextWindow, prompt);
            let previousFunctionCalls = 0;
            const resolvedResponsePrefix = (responsePrefix != null && responsePrefix !== "")
                ? responsePrefix
                : undefined;
            newChatHistory.push({
                type: "model",
                response: resolvedResponsePrefix != null
                    ? [resolvedResponsePrefix]
                    : []
            });
            if (newContextWindowChatHistory != null)
                newContextWindowChatHistory.push({
                    type: "model",
                    response: resolvedResponsePrefix != null
                        ? [resolvedResponsePrefix]
                        : []
                });
            if (resolvedResponsePrefix != null) {
                safeEventCallback(onToken)?.(this.model.tokenize(resolvedResponsePrefix));
                safeEventCallback(onTextChunk)?.(resolvedResponsePrefix);
                safeEventCallback(onResponseChunk)?.({
                    type: undefined,
                    segmentType: undefined,
                    text: resolvedResponsePrefix,
                    tokens: this.model.tokenize(resolvedResponsePrefix)
                });
            }
            try {
                while (true) {
                    const functionCallsAndResults = [];
                    let canThrowFunctionCallingErrors = false;
                    let abortedOnFunctionCallError = false;
                    const initialOutputTokens = this._chat.sequence.tokenMeter.usedOutputTokens;
                    const { lastEvaluation: currentLastEvaluation, metadata } = await this._chat.generateResponse(newChatHistory, {
                        functions,
                        documentFunctionParams,
                        maxParallelFunctionCalls,
                        grammar: grammar, // this is a workaround to allow passing both `functions` and `grammar`
                        onTextChunk: safeEventCallback(onTextChunk),
                        onToken: safeEventCallback(onToken),
                        onResponseChunk: safeEventCallback(onResponseChunk),
                        onFunctionCallParamsChunk: onFunctionCallParamsChunk == null
                            ? undefined
                            : safeEventCallback((chunk) => onFunctionCallParamsChunk?.({
                                callIndex: previousFunctionCalls + chunk.callIndex,
                                functionName: chunk.functionName,
                                paramsChunk: chunk.paramsChunk,
                                done: chunk.done
                            })),
                        budgets: {
                            includeCurrentResponse: true,
                            thoughtTokens: budgets?.thoughtTokens,
                            commentTokens: budgets?.commentTokens
                        },
                        signal: abortController.signal,
                        stopOnAbortSignal,
                        repeatPenalty,
                        minP,
                        topK,
                        topP,
                        seed,
                        tokenBias,
                        customStopTriggers,
                        maxTokens,
                        temperature,
                        trimWhitespaceSuffix,
                        contextShift: {
                            ...this._contextShift,
                            lastEvaluationMetadata: lastEvaluation?.contextShiftMetadata
                        },
                        evaluationPriority,
                        lastEvaluationContextWindow: {
                            history: newContextWindowChatHistory,
                            minimumOverlapPercentageToPreventContextShift: 0.5
                        },
                        onFunctionCall: async (functionCall) => {
                            functionCallsAndResults.push((async () => {
                                try {
                                    const functionDefinition = functions?.[functionCall.functionName];
                                    if (functionDefinition == null)
                                        throw new Error(`The model tried to call function "${functionCall.functionName}" which is not defined`);
                                    const functionCallResult = await functionDefinition.handler(functionCall.params);
                                    return {
                                        functionCall,
                                        functionDefinition,
                                        functionCallResult
                                    };
                                }
                                catch (err) {
                                    if (!abortController.signal.aborted) {
                                        abortedOnFunctionCallError = true;
                                        abortController.abort(err);
                                    }
                                    if (canThrowFunctionCallingErrors)
                                        throw err;
                                    return null;
                                }
                            })());
                        }
                    });
                    this._ensureNotDisposed();
                    if (abortController.signal.aborted && (abortedOnFunctionCallError || !stopOnAbortSignal))
                        throw abortController.signal.reason;
                    if (maxTokens != null)
                        maxTokens = Math.max(0, maxTokens - (this._chat.sequence.tokenMeter.usedOutputTokens - initialOutputTokens));
                    lastEvaluation = currentLastEvaluation;
                    newChatHistory = lastEvaluation.cleanHistory;
                    if (functionCallsAndResults.length > 0) {
                        canThrowFunctionCallingErrors = true;
                        const functionCallResultsPromise = Promise.all(functionCallsAndResults);
                        const raceEventAbortController = new AbortController();
                        await Promise.race([
                            functionCallResultsPromise,
                            new Promise((accept, reject) => {
                                abortController.signal.addEventListener("abort", () => {
                                    if (abortedOnFunctionCallError || !stopOnAbortSignal)
                                        reject(abortController.signal.reason);
                                    else
                                        accept();
                                }, { signal: raceEventAbortController.signal });
                                if (abortController.signal.aborted) {
                                    if (abortedOnFunctionCallError || !stopOnAbortSignal)
                                        reject(abortController.signal.reason);
                                    else
                                        accept();
                                }
                            })
                        ]);
                        raceEventAbortController.abort();
                        this._ensureNotDisposed();
                        if (!abortController.signal.aborted) {
                            const functionCallResults = (await functionCallResultsPromise)
                                .filter((result) => result != null);
                            this._ensureNotDisposed();
                            if (abortController.signal.aborted && (abortedOnFunctionCallError || !stopOnAbortSignal))
                                throw abortController.signal.reason;
                            newContextWindowChatHistory = lastEvaluation.contextWindow;
                            let startNewChunk = supportsParallelFunctionCalling;
                            for (const { functionCall, functionDefinition, functionCallResult } of functionCallResults) {
                                newChatHistory = addFunctionCallToChatHistory({
                                    chatHistory: newChatHistory,
                                    functionName: functionCall.functionName,
                                    functionDescription: functionDefinition.description,
                                    callParams: functionCall.params,
                                    callResult: functionCallResult,
                                    rawCall: functionCall.raw,
                                    startsNewChunk: startNewChunk
                                });
                                newContextWindowChatHistory = addFunctionCallToChatHistory({
                                    chatHistory: newContextWindowChatHistory,
                                    functionName: functionCall.functionName,
                                    functionDescription: functionDefinition.description,
                                    callParams: functionCall.params,
                                    callResult: functionCallResult,
                                    rawCall: functionCall.raw,
                                    startsNewChunk: startNewChunk
                                });
                                startNewChunk = false;
                                previousFunctionCalls++;
                            }
                            lastEvaluation.cleanHistory = newChatHistory;
                            lastEvaluation.contextWindow = newContextWindowChatHistory;
                            if (abortController.signal.aborted && !abortedOnFunctionCallError && stopOnAbortSignal) {
                                metadata.stopReason = "abort";
                                metadata.remainingGenerationAfterStop = undefined;
                            }
                            else
                                continue;
                        }
                    }
                    this._lastEvaluation = lastEvaluation;
                    this._canUseContextWindowForCompletion = true;
                    this._chatHistory = newChatHistory;
                    this._chatHistoryStateRef = {};
                    const lastModelResponseItem = getLastModelResponseItem(newChatHistory);
                    const responseText = lastModelResponseItem.response
                        .filter((item) => typeof item === "string")
                        .join("");
                    if (metadata.stopReason === "customStopTrigger")
                        return {
                            response: lastModelResponseItem.response,
                            responseText,
                            stopReason: metadata.stopReason,
                            customStopTrigger: metadata.customStopTrigger,
                            remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                        };
                    return {
                        response: lastModelResponseItem.response,
                        responseText,
                        stopReason: metadata.stopReason,
                        remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                    };
                }
            }
            finally {
                disposeAbortController();
            }
        });
    }
    /**
     * Preload a user prompt into the current context sequence state to make later inference of the model response begin sooner
     * and feel faster.
     *
     * > **Note:** Preloading a long user prompt can incur context shifts, so consider limiting the length of prompts you preload
     * @param prompt - the prompt to preload
     * @param [options]
     */
    async preloadPrompt(prompt, options = {}) {
        await this.completePromptWithMeta(prompt, {
            ...options,
            completeAsModel: false,
            maxTokens: 0
        });
    }
    /**
     * Preload a user prompt into the current context sequence state and generate a completion for it.
     *
     * > **Note:** Preloading a long user prompt and completing a user prompt with a high number of `maxTokens` can incur context shifts,
     * > so consider limiting the length of prompts you preload.
     * >
     * > Also, it's recommended to limit the number of tokens generated to a reasonable amount by configuring `maxTokens`.
     * @param prompt - the prompt to preload
     * @param [options]
     */
    async completePrompt(prompt, options = {}) {
        const { completion } = await this.completePromptWithMeta(prompt, options);
        return completion;
    }
    /**
     * Create a smart completion engine that caches the prompt completions
     * and reuses them when the user prompt matches the beginning of the cached prompt or completion.
     *
     * All completions are made and cache is used only for the current chat session state.
     * You can create a single completion engine for an entire chat session.
     */
    createPromptCompletionEngine(options) {
        return LlamaChatSessionPromptCompletionEngine._create(this, options);
    }
    /**
     * See `completePrompt` for more information.
     * @param prompt
     * @param [options]
     */
    async completePromptWithMeta(prompt, { maxTokens, stopOnAbortSignal = false, functions, documentFunctionParams, onTextChunk, onToken, signal, temperature, minP, topK, topP, seed, grammar, trimWhitespaceSuffix = false, repeatPenalty, tokenBias, customStopTriggers, evaluationPriority, completeAsModel } = {}) {
        this._ensureNotDisposed();
        if (grammar != null) {
            if (grammar._llama == null)
                throw new Error("The grammar passed to this function is not a LlamaGrammar instance.");
            else if (grammar._llama !== this.model._llama)
                throw new Error("The LlamaGrammar used by passed to this function was created with a different Llama instance than the one used by this sequence's model. Make sure you use the same Llama instance for both the model and the grammar.");
        }
        const [abortController, disposeAbortController] = wrapAbortSignal(signal);
        this._preloadAndCompleteAbortControllers.add(abortController);
        const completeAsModelEnabled = typeof completeAsModel == "boolean"
            ? completeAsModel
            : completeAsModel === "auto"
                ? "auto"
                : completeAsModel?.enabled ?? defaultCompleteAsModel.enabled;
        const modelArchitecture = this.model.fileInfo.metadata?.general?.architecture;
        const shouldCompleteAsModel = completeAsModelEnabled === "auto"
            ? modelArchitecture === GgufArchitectureType.gptOss
            : completeAsModelEnabled;
        try {
            return await withLock([this._chatLock, "evaluation"], abortController.signal, async () => {
                this._ensureNotDisposed();
                if (this._chat == null)
                    throw new DisposedError();
                if (shouldCompleteAsModel) {
                    const messagesToAppendOption = (typeof completeAsModel == "boolean" || completeAsModel === "auto")
                        ? defaultCompleteAsModel.appendedMessages
                        : completeAsModel?.appendedMessages ?? defaultCompleteAsModel.appendedMessages;
                    const messagesToAppend = messagesToAppendOption.length === 0
                        ? defaultCompleteAsModel.appendedMessages
                        : messagesToAppendOption;
                    const addMessageToChatHistory = (chatHistory) => {
                        const newHistory = chatHistory.slice();
                        if (messagesToAppend.at(0)?.type === "model")
                            newHistory.push({ type: "user", text: "" });
                        for (let i = 0; i < messagesToAppend.length; i++) {
                            const item = messagesToAppend[i];
                            const isLastItem = i === messagesToAppend.length - 1;
                            if (item == null)
                                continue;
                            if (isLastItem && item.type === "model") {
                                const newResponse = item.response.slice();
                                if (typeof newResponse.at(-1) === "string")
                                    newResponse.push(newResponse.pop() + prompt);
                                else
                                    newResponse.push(prompt);
                                newHistory.push({
                                    type: "model",
                                    response: newResponse
                                });
                            }
                            else
                                newHistory.push(item);
                        }
                        if (messagesToAppend.at(-1)?.type !== "model")
                            newHistory.push({ type: "model", response: [prompt] });
                        return {
                            history: newHistory,
                            addedCount: newHistory.length - chatHistory.length
                        };
                    };
                    const { history: messagesWithPrompt, addedCount } = addMessageToChatHistory(this._chatHistory);
                    const { response, lastEvaluation, metadata } = await this._chat.generateResponse(messagesWithPrompt, {
                        abortOnNonText: true,
                        functions,
                        documentFunctionParams,
                        grammar: grammar, // this is allowed only because `abortOnNonText` is enabled
                        onTextChunk,
                        onToken,
                        signal: abortController.signal,
                        stopOnAbortSignal: true,
                        repeatPenalty,
                        minP,
                        topK,
                        topP,
                        seed,
                        tokenBias,
                        customStopTriggers,
                        maxTokens: maxTokens == null
                            ? undefined
                            : Math.min(1, maxTokens), // regular prompting ignores `maxTokens: 0`
                        temperature,
                        trimWhitespaceSuffix,
                        contextShift: {
                            ...this._contextShift,
                            lastEvaluationMetadata: this._lastEvaluation?.contextShiftMetadata
                        },
                        evaluationPriority,
                        lastEvaluationContextWindow: {
                            history: this._lastEvaluation?.contextWindow == null
                                ? undefined
                                : addMessageToChatHistory(this._lastEvaluation?.contextWindow).history,
                            minimumOverlapPercentageToPreventContextShift: 0.8
                        }
                    });
                    this._ensureNotDisposed();
                    this._lastEvaluation = {
                        cleanHistory: this._chatHistory,
                        contextWindow: lastEvaluation.contextWindow.slice(0, -addedCount),
                        contextShiftMetadata: lastEvaluation.contextShiftMetadata
                    };
                    this._canUseContextWindowForCompletion = this._chatHistory.at(-1)?.type === "user";
                    if (!stopOnAbortSignal && metadata.stopReason === "abort" && abortController.signal?.aborted)
                        throw abortController.signal.reason;
                    if (metadata.stopReason === "customStopTrigger")
                        return {
                            completion: response,
                            stopReason: metadata.stopReason,
                            customStopTrigger: metadata.customStopTrigger,
                            remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                        };
                    return {
                        completion: response,
                        stopReason: metadata.stopReason,
                        remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                    };
                }
                else {
                    const { completion, lastEvaluation, metadata } = await this._chat.loadChatAndCompleteUserMessage(asWithLastUserMessageRemoved(this._chatHistory), {
                        initialUserPrompt: prompt,
                        functions,
                        documentFunctionParams,
                        grammar,
                        onTextChunk,
                        onToken,
                        signal: abortController.signal,
                        stopOnAbortSignal: true,
                        repeatPenalty,
                        minP,
                        topK,
                        topP,
                        seed,
                        tokenBias,
                        customStopTriggers,
                        maxTokens,
                        temperature,
                        trimWhitespaceSuffix,
                        contextShift: {
                            ...this._contextShift,
                            lastEvaluationMetadata: this._lastEvaluation?.contextShiftMetadata
                        },
                        evaluationPriority,
                        lastEvaluationContextWindow: {
                            history: asWithLastUserMessageRemoved(this._lastEvaluation?.contextWindow),
                            minimumOverlapPercentageToPreventContextShift: 0.8
                        }
                    });
                    this._ensureNotDisposed();
                    this._lastEvaluation = {
                        cleanHistory: this._chatHistory,
                        contextWindow: asWithLastUserMessageRemoved(lastEvaluation.contextWindow),
                        contextShiftMetadata: lastEvaluation.contextShiftMetadata
                    };
                    this._canUseContextWindowForCompletion = this._chatHistory.at(-1)?.type === "user";
                    if (!stopOnAbortSignal && metadata.stopReason === "abort" && abortController.signal?.aborted)
                        throw abortController.signal.reason;
                    if (metadata.stopReason === "customStopTrigger")
                        return {
                            completion: completion,
                            stopReason: metadata.stopReason,
                            customStopTrigger: metadata.customStopTrigger,
                            remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                        };
                    return {
                        completion: completion,
                        stopReason: metadata.stopReason,
                        remainingGenerationAfterStop: metadata.remainingGenerationAfterStop
                    };
                }
            });
        }
        finally {
            this._preloadAndCompleteAbortControllers.delete(abortController);
            disposeAbortController();
        }
    }
    getChatHistory() {
        return structuredClone(this._chatHistory);
    }
    getLastEvaluationContextWindow() {
        if (this._lastEvaluation == null)
            return null;
        return structuredClone(this._lastEvaluation?.contextWindow);
    }
    setChatHistory(chatHistory) {
        this._chatHistory = structuredClone(chatHistory);
        this._chatHistoryStateRef = {};
        this._lastEvaluation = undefined;
        this._canUseContextWindowForCompletion = false;
    }
    /** Clear the chat history and reset it to the initial state. */
    resetChatHistory() {
        if (this._chat == null || this.disposed)
            throw new DisposedError();
        const chatWrapperSupportsSystemMessages = this._chat.chatWrapper.settings.supportsSystemMessages;
        if (chatWrapperSupportsSystemMessages == null || chatWrapperSupportsSystemMessages || this._forceAddSystemPrompt)
            this.setChatHistory(this._chat.chatWrapper.generateInitialChatHistory({ systemPrompt: this._systemPrompt }));
        else
            this.setChatHistory([]);
    }
    /** @internal */
    _stopAllPreloadAndPromptCompletions() {
        for (const abortController of this._preloadAndCompleteAbortControllers)
            abortController.abort();
        this._preloadAndCompleteAbortControllers.clear();
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this.disposed)
            throw new DisposedError();
    }
}
function addFunctionCallToChatHistory({ chatHistory, functionName, functionDescription, callParams, callResult, rawCall, startsNewChunk }) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length === 0 || newChatHistory[newChatHistory.length - 1].type !== "model")
        newChatHistory.push({
            type: "model",
            response: []
        });
    const lastModelResponseItem = newChatHistory[newChatHistory.length - 1];
    const newLastModelResponseItem = { ...lastModelResponseItem };
    newChatHistory[newChatHistory.length - 1] = newLastModelResponseItem;
    const modelResponse = newLastModelResponseItem.response.slice();
    newLastModelResponseItem.response = modelResponse;
    const functionCall = {
        type: "functionCall",
        name: functionName,
        description: functionDescription,
        params: callParams,
        result: callResult,
        rawCall
    };
    if (startsNewChunk)
        functionCall.startsNewChunk = true;
    modelResponse.push(functionCall);
    return newChatHistory;
}
function getLastModelResponseItem(chatHistory) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].type !== "model")
        throw new Error("Expected chat history to end with a model response");
    return chatHistory[chatHistory.length - 1];
}
function asWithLastUserMessageRemoved(chatHistory) {
    if (chatHistory == null)
        return chatHistory;
    const newChatHistory = chatHistory.slice();
    while (newChatHistory.at(-1)?.type === "user")
        newChatHistory.pop();
    return newChatHistory;
}
//# sourceMappingURL=LlamaChatSession.js.map