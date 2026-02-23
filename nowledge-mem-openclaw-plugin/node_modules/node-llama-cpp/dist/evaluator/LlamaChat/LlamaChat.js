import { DisposeAggregator, DisposedError, EventRelay, withLock } from "lifecycle-utils";
import { isChatModelResponseFunctionCall, isChatModelResponseSegment, allSegmentTypes } from "../../types.js";
import { removeNullFields } from "../../utils/removeNullFields.js";
import { LlamaGrammarEvaluationState } from "../LlamaGrammarEvaluationState.js";
import { LlamaText, SpecialToken } from "../../utils/LlamaText.js";
import { StopGenerationDetector } from "../../utils/StopGenerationDetector.js";
import { TokenStreamRegulator } from "../../utils/TokenStreamRegulator.js";
import { maxRecentDetokenizerTokens, UNKNOWN_UNICODE_CHAR } from "../../consts.js";
import { getQueuedTokensBeforeStopTrigger } from "../../utils/getQueuedTokensBeforeStopTrigger.js";
import { resolveChatWrapper } from "../../chatWrappers/utils/resolveChatWrapper.js";
import { safeEventCallback } from "../../utils/safeEventCallback.js";
import { pushAll } from "../../utils/pushAll.js";
import { resolveLastTokens } from "../../utils/resolveLastTokens.js";
import { LlamaSampler } from "../LlamaContext/LlamaSampler.js";
import { getChatWrapperSegmentDefinition } from "../../utils/getChatWrapperSegmentDefinition.js";
import { jsonDumps } from "../../chatWrappers/utils/jsonDumps.js";
import { defaultMaxPreloadTokens } from "../LlamaChatSession/utils/LlamaChatSessionPromptCompletionEngine.js";
import { eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy } from "./utils/contextShiftStrategies/eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy.js";
import { FunctionCallNameGrammar } from "./utils/FunctionCallNameGrammar.js";
import { FunctionCallParamsGrammar } from "./utils/FunctionCallParamsGrammar.js";
const defaultContextShiftOptions = {
    size: (sequence) => Math.max(1, Math.floor(sequence.context.contextSize / 10)),
    strategy: "eraseFirstResponseAndKeepFirstSystem",
    lastEvaluationMetadata: null
};
const defaultRepeatPenaltyLastTokens = 64;
const defaultTrimWhitespaceSuffix = false;
const defaultEvaluationPriority = 5;
export class LlamaChat {
    /** @internal */ _chatWrapper;
    /** @internal */ _disposeAggregator = new DisposeAggregator();
    /** @internal */ _autoDisposeSequence;
    /** @internal */ _chatLock = {};
    /** @internal */ _sequence;
    onDispose = new EventRelay();
    constructor({ contextSequence, chatWrapper = "auto", autoDisposeSequence = false }) {
        if (contextSequence == null)
            throw new Error("contextSequence cannot be null");
        if (contextSequence.disposed)
            throw new DisposedError();
        this._sequence = contextSequence;
        this._autoDisposeSequence = autoDisposeSequence;
        this._disposeAggregator.add(this._sequence.onDispose.createListener(() => {
            this.dispose();
        }));
        this._disposeAggregator.add(this.onDispose.dispatchEvent);
        this._chatWrapper = chatWrapper === "auto"
            ? resolveChatWrapper(contextSequence.model)
            : chatWrapper;
    }
    dispose({ disposeSequence = this._autoDisposeSequence } = {}) {
        if (this._sequence == null)
            return;
        if (disposeSequence)
            this._sequence.dispose();
        this._sequence = null;
        this._disposeAggregator.dispose();
    }
    /** @hidden */
    [Symbol.dispose]() {
        return this.dispose();
    }
    get disposed() {
        return this._sequence == null;
    }
    get chatWrapper() {
        if (this._sequence == null)
            throw new DisposedError();
        return this._chatWrapper;
    }
    get sequence() {
        if (this._sequence == null)
            throw new DisposedError();
        return this._sequence;
    }
    get context() {
        return this.sequence.context;
    }
    get model() {
        return this.sequence.model;
    }
    async generateResponse(history, options = {}) {
        const { onTextChunk, onToken, onResponseChunk, onFunctionCallParamsChunk, budgets, signal, stopOnAbortSignal = false, maxTokens, temperature, minP, topK, topP, seed, grammar, trimWhitespaceSuffix = defaultTrimWhitespaceSuffix, repeatPenalty = {}, tokenBias, evaluationPriority = defaultEvaluationPriority, functions, onFunctionCall, documentFunctionParams, maxParallelFunctionCalls, contextShift = defaultContextShiftOptions, customStopTriggers, abortOnNonText = false, lastEvaluationContextWindow: { history: lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift = 0.5 } = {} } = options;
        this.sequence.tokenPredictor?.updateInputTokens?.(this.model.tokenize(findLastUserMessageInChatHistory(history)?.text ?? ""));
        const generateResponseState = new GenerateResponseState(this, this._chatWrapper, history, {
            onTextChunk,
            onToken,
            onResponseChunk,
            onFunctionCallParamsChunk,
            budgets,
            signal,
            stopOnAbortSignal,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            seed,
            grammar: grammar, // this is a workaround to allow passing both `functions` and `grammar`
            trimWhitespaceSuffix,
            repeatPenalty,
            tokenBias,
            evaluationPriority,
            functions,
            onFunctionCall,
            documentFunctionParams,
            maxParallelFunctionCalls,
            contextShift,
            customStopTriggers,
            abortOnNonText,
            lastEvaluationContextWindow: {
                history: lastEvaluationContextWindowHistory,
                minimumOverlapPercentageToPreventContextShift
            }
        });
        if (generateResponseState.grammar != null && generateResponseState.functionsEnabled && !abortOnNonText)
            throw new Error("Using both grammar and functions is not supported yet");
        return await withLock([this._chatLock, "evaluate"], signal, async () => {
            try {
                generateResponseState.ensureLastHistoryItemIsModel();
                generateResponseState.ensureReopenedThoughtSegmentAfterFunctionCallsIfNeeded();
                const loadContextWindow = async (avoidReloadingHistory = false) => {
                    await generateResponseState.loadContextWindow(generateResponseState.getResolvedHistoryWithCurrentModelResponse(), generateResponseState.getContextWindowsHistoryWithCurrentModelResponse(), false, avoidReloadingHistory);
                };
                const loadContextWindowForFunctionCallingLoop = async () => loadContextWindow(true);
                while (true) {
                    generateResponseState.startTokenLoop();
                    generateResponseState.handleRerender();
                    const shouldHandlePrefixTriggers = generateResponseState.isRerender;
                    generateResponseState.canAvoidReloadingHistory = false;
                    await loadContextWindow();
                    generateResponseState.isRerender = false;
                    generateResponseState.addStopGenerationTriggersFromChatWrapper();
                    if (generateResponseState.generatedTokens === 0) {
                        generateResponseState.addIgnoreStartTextTriggersFromChatWrapper();
                        if (generateResponseState.functionsEnabled) {
                            generateResponseState.initFunctions();
                        }
                    }
                    const abortRes = generateResponseState.handleAbortTrigger("model");
                    if (abortRes != null)
                        return abortRes;
                    if (shouldHandlePrefixTriggers) {
                        const handlePrefixTriggersRes = await generateResponseState.handlePrefixTriggers(loadContextWindowForFunctionCallingLoop);
                        if (handlePrefixTriggersRes != null)
                            return handlePrefixTriggersRes;
                    }
                    if (generateResponseState.functionEvaluationMode !== false && !generateResponseState.abortOnNonText) {
                        const functionsCallsRes = await generateResponseState.enterFunctionCallingLoop(loadContextWindowForFunctionCallingLoop);
                        if (functionsCallsRes != null)
                            return functionsCallsRes;
                        await loadContextWindowForFunctionCallingLoop();
                    }
                    await generateResponseState.alignCurrentSequenceStateWithCurrentTokens();
                    await generateResponseState.createNewEvaluationIterator();
                    while (await generateResponseState.iterateEvaluation()) {
                        if (!generateResponseState.holdPartialTokensForNextEvaluation()) {
                            generateResponseState.waitOnPartialCharactersOrWhiteSpaceTokens();
                            generateResponseState.detectAndHandleFunctionStartSyntax();
                            if (generateResponseState.functionEvaluationMode !== false) {
                                generateResponseState.canAvoidReloadingHistory = false;
                                generateResponseState.releasePartiallyFreeTokensBeforeFunctionCallStart();
                                const functionsCallsRes = await generateResponseState.enterFunctionCallingLoop(loadContextWindowForFunctionCallingLoop);
                                if (functionsCallsRes != null)
                                    return functionsCallsRes;
                            }
                            generateResponseState.recordStopGenerationEvaluation();
                            generateResponseState.popStreamRegulatorFreeTokens();
                            generateResponseState.removeFoundStartIgnoreTextsFromPendingTokens();
                            const stopGenerationTriggerRes = generateResponseState.handleStopGenerationTrigger("model");
                            if (stopGenerationTriggerRes != null)
                                return stopGenerationTriggerRes;
                            generateResponseState.spliceIgnoreStartTextDetectedTokens();
                            generateResponseState.moveFreePendingTokensToRes();
                        }
                        const maxTokensTriggerRes = generateResponseState.handleMaxTokensTrigger("model");
                        if (maxTokensTriggerRes != null)
                            return maxTokensTriggerRes;
                        if (generateResponseState.handleShouldRerender() || generateResponseState.updateShouldContextShift())
                            break;
                        if (await generateResponseState.handleBudgetTriggers()) {
                            generateResponseState.shouldRerender = true;
                            generateResponseState.skipClosingResponseItemOnRerender = true;
                            break;
                        }
                        if (generateResponseState.handleShouldRerender() || generateResponseState.updateShouldContextShift())
                            break;
                        const abortRes = generateResponseState.handleAbortTrigger("model");
                        if (abortRes != null)
                            return abortRes;
                    }
                    generateResponseState.isFirstEvaluation = false;
                    if (generateResponseState.shouldRerender || generateResponseState.shouldContextShift)
                        continue;
                    break;
                }
                throw new Error("The context size is too small to generate a response");
            }
            finally {
                await generateResponseState.dispose();
            }
        });
    }
    async loadChatAndCompleteUserMessage(history, options = {}) {
        const { initialUserPrompt = "", stopOnAbortSignal = false, onTextChunk, onToken, signal, maxTokens = defaultMaxPreloadTokens(this.sequence), temperature, minP, topK, topP, seed, grammar, trimWhitespaceSuffix = defaultTrimWhitespaceSuffix, repeatPenalty = {}, tokenBias, evaluationPriority = defaultEvaluationPriority, functions, documentFunctionParams, contextShift = defaultContextShiftOptions, customStopTriggers, lastEvaluationContextWindow: { history: lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift = 0.8 } = {} } = options;
        this.sequence.tokenPredictor?.updateInputTokens?.(this.model.tokenize((findLastModelMessageInChatHistory(history)?.response ?? [])
            .map((item) => {
            if (typeof item === "string")
                return item;
            else if (isChatModelResponseFunctionCall(item))
                return null;
            else if (isChatModelResponseSegment(item))
                return item.text;
            void item;
            return null;
        })
            .filter((item) => item != null)
            .join(" ")));
        const generateResponseState = new GenerateResponseState(this, this._chatWrapper, mergeGeneratedResultWithChatHistory("user", history, [initialUserPrompt]), {
            onTextChunk,
            onToken,
            signal,
            stopOnAbortSignal,
            maxTokens,
            temperature,
            minP,
            topK,
            topP,
            seed,
            grammar: grammar, // this is a workaround to allow passing both `functions` and `grammar`
            trimWhitespaceSuffix,
            repeatPenalty,
            tokenBias,
            evaluationPriority,
            functions,
            documentFunctionParams,
            contextShift,
            customStopTriggers,
            lastEvaluationContextWindow: {
                history: mergeGeneratedResultWithChatHistory("user", lastEvaluationContextWindowHistory ?? history, [initialUserPrompt]),
                minimumOverlapPercentageToPreventContextShift
            }
        });
        return await withLock([this._chatLock, "evaluate"], signal, async () => {
            try {
                generateResponseState.ensureLastHistoryItemIsUser();
                while (true) {
                    generateResponseState.startTokenLoop();
                    const { userTextSuffix } = await generateResponseState.loadContextWindow(mergeGeneratedResultWithChatHistory("user", generateResponseState.resolvedHistory, generateResponseState.segmentHandler.getModelResponseSegments()), mergeGeneratedResultWithChatHistory("user", generateResponseState.lastContextWindowHistory, generateResponseState.segmentHandler.getContextWindowModelResponseSegments()), true);
                    generateResponseState.isRerender = false;
                    generateResponseState.functionEvaluationMode = false;
                    generateResponseState.addStopGenerationTriggersFromChatWrapper();
                    if (userTextSuffix != null && userTextSuffix.values.length > 0)
                        generateResponseState.stopGenerationDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(userTextSuffix, this.model.tokenizer));
                    generateResponseState.rerenderTriggers.forEach((trigger) => (generateResponseState.stopGenerationDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(trigger, this.model.tokenizer))));
                    allSegmentTypes
                        .map((segmentType) => getChatWrapperSegmentDefinition(this._chatWrapper.settings, segmentType))
                        .filter((segmentDefinition) => segmentDefinition != null)
                        .flatMap((segmentDefinition) => [segmentDefinition?.prefix, segmentDefinition?.suffix])
                        .filter((trigger) => trigger != null)
                        .forEach((trigger) => (generateResponseState.stopGenerationDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(trigger), this.model.tokenizer))));
                    await generateResponseState.alignCurrentSequenceStateWithCurrentTokens();
                    if (generateResponseState.maxTokens === 0) {
                        await generateResponseState.evaluateWithoutGeneratingNewTokens();
                        return {
                            completion: "",
                            lastEvaluation: {
                                contextWindow: mergeGeneratedResultWithChatHistory("user", generateResponseState.lastContextWindowHistory, generateResponseState.segmentHandler.getContextWindowModelResponseSegments()),
                                contextShiftMetadata: generateResponseState.lastHistoryCompressionMetadata
                            },
                            metadata: {
                                stopReason: "maxTokens"
                            }
                        };
                    }
                    await generateResponseState.createNewEvaluationIterator();
                    while (await generateResponseState.iterateEvaluation()) {
                        if (!generateResponseState.holdPartialTokensForNextEvaluation()) {
                            generateResponseState.waitOnPartialCharactersOrWhiteSpaceTokens();
                            generateResponseState.recordStopGenerationEvaluation();
                            generateResponseState.popStreamRegulatorFreeTokens();
                            const someOfCurrentTokensAreSpecial = generateResponseState.currentTokens.some((token) => (this.model.isSpecialToken(token)));
                            const stopGenerationTriggerRes = generateResponseState.handleStopGenerationTrigger("user", someOfCurrentTokensAreSpecial
                                ? "eogToken"
                                : undefined);
                            if (stopGenerationTriggerRes != null)
                                return {
                                    completion: stopGenerationTriggerRes.response,
                                    lastEvaluation: {
                                        contextWindow: mergeGeneratedResultWithChatHistory("user", generateResponseState.lastContextWindowHistory, generateResponseState.segmentHandler.getContextWindowModelResponseSegments()),
                                        contextShiftMetadata: stopGenerationTriggerRes.lastEvaluation.contextShiftMetadata
                                    },
                                    metadata: stopGenerationTriggerRes.metadata.stopReason === "customStopTrigger"
                                        ? stopGenerationTriggerRes.metadata
                                        : stopGenerationTriggerRes.metadata
                                };
                            generateResponseState.moveFreePendingTokensToRes(false);
                        }
                        const maxTokensTriggerRes = generateResponseState.handleMaxTokensTrigger("user");
                        if (maxTokensTriggerRes != null)
                            return {
                                completion: maxTokensTriggerRes.response,
                                lastEvaluation: {
                                    contextWindow: mergeGeneratedResultWithChatHistory("user", generateResponseState.lastContextWindowHistory, generateResponseState.segmentHandler.getContextWindowModelResponseSegments()),
                                    contextShiftMetadata: maxTokensTriggerRes.lastEvaluation.contextShiftMetadata
                                },
                                metadata: maxTokensTriggerRes.metadata
                            };
                        if (generateResponseState.updateShouldContextShift())
                            break;
                        const abortRes = generateResponseState.handleAbortTrigger("user");
                        if (abortRes != null)
                            return {
                                completion: abortRes.response,
                                lastEvaluation: {
                                    contextWindow: mergeGeneratedResultWithChatHistory("user", generateResponseState.lastContextWindowHistory, generateResponseState.segmentHandler.getContextWindowModelResponseSegments()),
                                    contextShiftMetadata: abortRes.lastEvaluation.contextShiftMetadata
                                },
                                metadata: abortRes.metadata
                            };
                    }
                    generateResponseState.isFirstEvaluation = false;
                    if (generateResponseState.shouldContextShift)
                        continue;
                    break;
                }
                throw new Error("The context size is too small to generate a completion");
            }
            finally {
                await generateResponseState.dispose();
            }
        });
    }
}
function removeRawFromHistoryItem(historyItem) {
    if (historyItem.type === "model") {
        const newHistoryItem = { ...historyItem };
        newHistoryItem.response = newHistoryItem.response.map((item) => {
            if (typeof item === "string")
                return item;
            else if (isChatModelResponseFunctionCall(item))
                return {
                    ...item,
                    rawCall: undefined
                };
            else if (isChatModelResponseSegment(item))
                return {
                    ...item,
                    raw: undefined
                };
            void item;
            return item;
        });
        return newHistoryItem;
    }
    return historyItem;
}
async function compressHistoryToFitContextSize({ history, contextShiftSize, contextShiftStrategy, contextShiftLastEvaluationMetadata, contextSize, tokenizer, chatWrapper, functions, documentFunctionParams }) {
    function checkIfHistoryFitsContext(history) {
        const { contextText } = chatWrapper.generateContextState({
            chatHistory: history,
            availableFunctions: functions,
            documentFunctionParams
        });
        const tokens = contextText.tokenize(tokenizer);
        return tokens.length <= contextSize - contextShiftSize;
    }
    if (contextSize - contextShiftSize <= 0)
        throw new Error(`The context size (${contextSize}) is too small to fit the context shift size (${contextShiftSize})`);
    if (checkIfHistoryFitsContext(history))
        return {
            compressedHistory: history,
            metadata: null
        };
    if (contextShiftStrategy instanceof Function) {
        try {
            const { chatHistory, metadata } = await contextShiftStrategy({
                chatHistory: history,
                maxTokensCount: contextSize - contextShiftSize,
                tokenizer,
                chatWrapper,
                lastShiftMetadata: contextShiftLastEvaluationMetadata
            });
            if (checkIfHistoryFitsContext(chatHistory))
                return {
                    compressedHistory: chatHistory,
                    metadata
                };
            console.warn("The provided context shift strategy did not return a history that fits the context size. " +
                "Using the default strategy instead.");
        }
        catch (err) {
            console.error("The provided context shift strategy threw an error. " +
                "Using the default strategy instead.", err);
        }
    }
    else if (contextShiftStrategy !== "eraseFirstResponseAndKeepFirstSystem")
        console.warn(`Unknown context shift strategy "${contextShiftStrategy}". ` +
            "Using the default strategy instead.");
    const { chatHistory, metadata } = await eraseFirstResponseAndKeepFirstSystemChatContextShiftStrategy({
        chatHistory: history,
        maxTokensCount: contextSize - contextShiftSize,
        tokenizer,
        chatWrapper,
        lastShiftMetadata: contextShiftLastEvaluationMetadata
    });
    if (!checkIfHistoryFitsContext(chatHistory))
        throw new Error("The default context shift strategy did not return a history that fits the context size. " +
            "This may happen due to the system prompt being too long");
    return {
        compressedHistory: chatHistory,
        metadata
    };
}
function getLastModelMessageFullResponseFromChatHistory(chatHistory) {
    const lastModelResponseItem = chatHistory.at(-1);
    if (lastModelResponseItem == null || lastModelResponseItem.type !== "model")
        return [];
    return lastModelResponseItem.response;
}
function getLastUserTextFromChatHistory(chatHistory) {
    if (chatHistory.length === 0 || chatHistory[chatHistory.length - 1].type !== "user")
        return "";
    return chatHistory[chatHistory.length - 1].text;
}
function setLastUserTextInChatHistory(chatHistory, userText) {
    const newChatHistory = chatHistory.slice();
    if (newChatHistory.length === 0 || newChatHistory[newChatHistory.length - 1].type !== "user")
        newChatHistory.push({
            type: "user",
            text: ""
        });
    const lastUserItem = newChatHistory[newChatHistory.length - 1];
    const newLastUserItem = { ...lastUserItem };
    newChatHistory[newChatHistory.length - 1] = newLastUserItem;
    newLastUserItem.text = userText;
    return newChatHistory;
}
function mergeGeneratedResultWithChatHistory(itemType, chatHistory, generatedResult) {
    if (generatedResult.length === 0 || (generatedResult.length === 1 && generatedResult[0] === ""))
        return chatHistory;
    const newChatHistory = chatHistory.slice();
    if (itemType === "user") {
        let lastUserItem = newChatHistory.at(-1);
        if (lastUserItem?.type !== "user") {
            lastUserItem = {
                type: "user",
                text: ""
            };
            newChatHistory.push(lastUserItem);
        }
        const newLastUserItem = { ...lastUserItem };
        newChatHistory[newChatHistory.length - 1] = newLastUserItem;
        newLastUserItem.text += generatedResult
            .map((item) => {
            if (typeof item === "string")
                return item;
            return item.text;
        })
            .join("");
        return newChatHistory;
    }
    else {
        let lastModelItem = newChatHistory.at(-1);
        if (lastModelItem?.type !== "model") {
            lastModelItem = {
                type: "model",
                response: []
            };
            newChatHistory.push(lastModelItem);
        }
        const newLastModelItem = { ...lastModelItem };
        newChatHistory[newChatHistory.length - 1] = newLastModelItem;
        const modelResponse = newLastModelItem.response.slice();
        newLastModelItem.response = modelResponse;
        const firstGeneratedResultItem = generatedResult[0];
        if (firstGeneratedResultItem == null)
            return newChatHistory;
        const lastModelResponseItem = modelResponse.at(-1);
        if (typeof firstGeneratedResultItem === "string" && typeof lastModelResponseItem === "string") {
            modelResponse[modelResponse.length - 1] = lastModelResponseItem + firstGeneratedResultItem;
        }
        else if (typeof firstGeneratedResultItem !== "string" && isChatModelResponseSegment(firstGeneratedResultItem) &&
            typeof lastModelResponseItem !== "string" && isChatModelResponseSegment(lastModelResponseItem) &&
            !lastModelResponseItem.ended && lastModelResponseItem.segmentType === firstGeneratedResultItem.segmentType) {
            modelResponse[modelResponse.length - 1] = {
                ...lastModelResponseItem,
                ...firstGeneratedResultItem,
                text: lastModelResponseItem.text + firstGeneratedResultItem.text,
                ended: firstGeneratedResultItem.ended,
                raw: (lastModelResponseItem.raw != null && firstGeneratedResultItem.raw != null)
                    ? LlamaText([
                        LlamaText.fromJSON(lastModelResponseItem.raw),
                        LlamaText.fromJSON(firstGeneratedResultItem.raw)
                    ]).toJSON()
                    : undefined,
                startTime: lastModelResponseItem.startTime,
                endTime: firstGeneratedResultItem.endTime
            };
        }
        else
            modelResponse.push(firstGeneratedResultItem);
        pushAll(modelResponse, generatedResult.slice(1));
        return newChatHistory;
    }
}
function findLastUserMessageInChatHistory(chatHistory) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const item = chatHistory[i];
        if (item.type === "user")
            return item;
    }
    return undefined;
}
function findLastModelMessageInChatHistory(chatHistory) {
    for (let i = chatHistory.length - 1; i >= 0; i--) {
        const item = chatHistory[i];
        if (item.type === "model")
            return item;
    }
    return undefined;
}
function generateContextText(endWithUserText, chatWrapper, options) {
    if (endWithUserText)
        return generateContextTextThatEndsWithUserText(chatWrapper, options);
    return chatWrapper.generateContextState(options);
}
function generateContextTextThatEndsWithUserText(chatWrapper, options) {
    const lastUserText = getLastUserTextFromChatHistory(options.chatHistory);
    const randomId = "W" + (Math.random()
        .toString(36)
        .slice(2)) + "W";
    const { contextText, ...rest } = chatWrapper.generateContextState({
        ...options,
        chatHistory: setLastUserTextInChatHistory(options.chatHistory, lastUserText + randomId)
    });
    for (let i = 0; i < contextText.values.length; i++) {
        const item = contextText.values[i];
        if (typeof item !== "string")
            continue;
        const randomTextIndex = item.indexOf(randomId);
        if (randomTextIndex < 0)
            continue;
        const newValue = item.slice(0, randomTextIndex);
        return {
            contextText: LlamaText([
                ...contextText.values.slice(0, i),
                newValue
            ]),
            userTextSuffix: LlamaText([
                item.slice(randomTextIndex + randomId.length),
                ...contextText.values.slice(i + 1)
            ]),
            ...rest
        };
    }
    throw new Error("The random ID was not found in the context text. " +
        `There might be an issue with the chat wrapper "${chatWrapper.wrapperName}" ` +
        "where not all user messages are properly added to the the result LlamaText");
}
async function getContextWindow({ resolvedHistory, resolvedContextShift, lastHistoryCompressionMetadata, pendingTokensCount = 0, isFirstEvaluation, isRerender, chatWrapper, lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift, sequence, minFreeContextTokens = 1, functions, documentFunctionParams, endWithUserText }) {
    if (sequence == null)
        throw new DisposedError();
    const model = sequence.model;
    const context = sequence.context;
    let removeRawFromHistory = false;
    if ((isFirstEvaluation || isRerender) && lastEvaluationContextWindowHistory != null && sequence.isLoadedToMemory) {
        const newContextWindow = lastEvaluationContextWindowHistory.slice();
        if (endWithUserText) {
            if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1].type !== "user")
                newContextWindow.push({
                    type: "user",
                    text: ""
                });
        }
        else if (newContextWindow.length === 0 || newContextWindow[newContextWindow.length - 1].type !== "model")
            newContextWindow.push({
                type: "model",
                response: []
            });
        const { contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix, prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls } = generateContextText(endWithUserText, chatWrapper, {
            chatHistory: newContextWindow,
            availableFunctions: functions,
            documentFunctionParams
        });
        const tokens = contextText.tokenize(model.tokenizer);
        if (tokens.length + pendingTokensCount + minFreeContextTokens < context.contextSize) {
            const { firstDifferentIndex } = sequence.compareContextTokens(tokens);
            const existingEvaluationPercentage = firstDifferentIndex / tokens.length;
            if (isRerender || existingEvaluationPercentage >= minimumOverlapPercentageToPreventContextShift)
                return {
                    history: newContextWindow,
                    stopGenerationTriggers,
                    tokens,
                    removeRawFromHistory,
                    newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                    ignoreStartText: ignoreStartText ?? [],
                    functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                    disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
                    userTextSuffix,
                    prefixTriggers,
                    noPrefixTrigger,
                    rerender,
                    detectFunctionCalls
                };
        }
    }
    removeRawFromHistory = !sequence.isLoadedToMemory;
    resolvedHistory = removeRawFromHistory
        ? resolvedHistory.map(removeRawFromHistoryItem)
        : resolvedHistory.slice();
    if (resolvedContextShift.lastEvaluationMetadata != null) {
        const contextShiftSize = resolvedContextShift.size instanceof Function
            ? await resolvedContextShift.size(sequence)
            : resolvedContextShift.size;
        const { compressedHistory, metadata } = await compressHistoryToFitContextSize({
            history: resolvedHistory,
            contextShiftSize: Math.max(minFreeContextTokens, Math.min(contextShiftSize, context.contextSize - pendingTokensCount)) + pendingTokensCount,
            contextShiftStrategy: resolvedContextShift.strategy,
            contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
            contextSize: context.contextSize,
            tokenizer: model.tokenizer,
            chatWrapper: chatWrapper,
            functions,
            documentFunctionParams
        });
        const { contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix, prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls } = generateContextText(endWithUserText, chatWrapper, {
            chatHistory: compressedHistory,
            availableFunctions: functions,
            documentFunctionParams
        });
        return {
            history: compressedHistory,
            stopGenerationTriggers,
            tokens: contextText.tokenize(model.tokenizer),
            removeRawFromHistory,
            newHistoryCompressionMetadata: metadata,
            ignoreStartText: ignoreStartText ?? [],
            functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
            disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
            userTextSuffix,
            prefixTriggers,
            noPrefixTrigger,
            rerender,
            detectFunctionCalls
        };
    }
    {
        const { contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix, prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls } = generateContextText(endWithUserText, chatWrapper, {
            chatHistory: resolvedHistory,
            availableFunctions: functions,
            documentFunctionParams
        });
        const tokens = contextText.tokenize(model.tokenizer);
        if (tokens.length + pendingTokensCount + minFreeContextTokens < context.contextSize)
            return {
                history: resolvedHistory,
                stopGenerationTriggers,
                tokens,
                removeRawFromHistory,
                newHistoryCompressionMetadata: lastHistoryCompressionMetadata,
                ignoreStartText: ignoreStartText ?? [],
                functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
                disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
                userTextSuffix,
                prefixTriggers,
                noPrefixTrigger,
                rerender,
                detectFunctionCalls
            };
    }
    const contextShiftSize = Math.min(context.contextSize, Math.max(1, Math.floor(resolvedContextShift.size instanceof Function
        ? await resolvedContextShift.size(sequence)
        : resolvedContextShift.size)));
    const { compressedHistory, metadata } = await compressHistoryToFitContextSize({
        history: resolvedHistory,
        contextShiftSize: Math.max(minFreeContextTokens, Math.min(contextShiftSize, context.contextSize - pendingTokensCount)) + pendingTokensCount,
        contextShiftStrategy: resolvedContextShift.strategy,
        contextShiftLastEvaluationMetadata: resolvedContextShift.lastEvaluationMetadata,
        contextSize: context.contextSize,
        tokenizer: model.tokenizer,
        chatWrapper: chatWrapper,
        functions,
        documentFunctionParams
    });
    const { contextText, stopGenerationTriggers, ignoreStartText, functionCall, userTextSuffix, prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls } = generateContextText(endWithUserText, chatWrapper, {
        chatHistory: compressedHistory,
        availableFunctions: functions,
        documentFunctionParams
    });
    return {
        history: compressedHistory,
        stopGenerationTriggers,
        tokens: contextText.tokenize(model.tokenizer),
        removeRawFromHistory,
        newHistoryCompressionMetadata: metadata,
        ignoreStartText: ignoreStartText ?? [],
        functionCallInitiallyEngaged: functionCall?.initiallyEngaged ?? false,
        disengageInitiallyEngagedFunctionCall: functionCall?.disengageInitiallyEngaged ?? [],
        userTextSuffix,
        prefixTriggers,
        noPrefixTrigger,
        rerender,
        detectFunctionCalls
    };
}
class GenerateResponseState {
    llamaChat;
    chatWrapper;
    history;
    onTextChunk;
    onToken;
    onResponseChunk;
    onFunctionCallParamsChunk;
    budgets;
    signal;
    stopOnAbortSignal;
    maxTokens;
    temperature;
    minP;
    topK;
    topP;
    seed;
    grammar;
    trimWhitespaceSuffix;
    tokenBias;
    evaluationPriority;
    functions;
    onFunctionCall;
    documentFunctionParams;
    maxParallelFunctionCalls;
    contextShift;
    customStopTriggers;
    abortOnNonText;
    minimumOverlapPercentageToPreventContextShift;
    functionsEnabled;
    repeatPenaltyEnabled;
    resolvedContextShift;
    resolvedRepeatPenalty;
    grammarEvaluationState;
    functionNameGrammar;
    functionsGrammar;
    functionsEvaluationState;
    functionSyntaxStartDetectorEnabled = true;
    streamRegulator = new TokenStreamRegulator();
    stopGenerationDetector = new StopGenerationDetector();
    customStopGenerationTriggersDetector = new StopGenerationDetector();
    functionSyntaxStartDetector = new StopGenerationDetector();
    disengageInitiallyEngagedFunctionMode = new StopGenerationDetector();
    ignoreStartTextDetector = new StopGenerationDetector();
    locksToReleaseOnValidGeneration = [];
    resolvedHistory;
    noRawInResolvedHistory;
    res = [];
    pendingTokens = [];
    ignoredStartTextTokens = [];
    prefixTriggerTokens = [];
    resFunctionCalls = [];
    segmentHandler;
    pendingPartialTokens = [];
    functionEvaluationMode = false;
    currentFunctionCallPreviousText = LlamaText([]);
    currentFunctionCallCurrentPartTokens = [];
    functionEvaluationFunctionName = "";
    currentFunctionCallPreviousPartLeftoverText = "";
    removedStartTextToIgnore = false;
    releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax = false;
    generatedTokens = 0;
    isFirstEvaluation = true;
    isRerender = true; // first render is a rerender
    initiallyEngagedFunctionMode = false;
    lastContextWindowHistory;
    lastHistoryCompressionMetadata;
    restartEvaluationIterator = false;
    // context shift loop
    shouldContextShift = false;
    shouldRerender = false;
    skipClosingResponseItemOnRerender = false;
    shouldAbortBecauseOfNonText = false;
    canAvoidReloadingHistory = false;
    contextWindowTokens = [];
    stopGenerationTriggers = [];
    ignoreStartText = [];
    functionCallInitiallyEngaged = false;
    disengageInitiallyEngagedFunctionCall = [];
    userTextSuffix = undefined;
    prefixTriggerDetectors = new Map();
    noPrefixTrigger = undefined;
    rerenderTriggers = [];
    rerenderTriggerDetector = new StopGenerationDetector();
    rerenderActions = undefined;
    tokens = [];
    // token evaluation loop
    evaluationIterator;
    currentIteration;
    currentIterationReplacementToken;
    currentToken;
    currentTokens = [];
    currentText = "";
    currentQueuedTokenRelease;
    constructor(llamaChat, chatWrapper, history, { onTextChunk, onToken, onResponseChunk, onFunctionCallParamsChunk, budgets, signal, stopOnAbortSignal = false, maxTokens, temperature, minP, topK, topP, seed, grammar, trimWhitespaceSuffix = defaultTrimWhitespaceSuffix, repeatPenalty = {}, tokenBias, evaluationPriority = defaultEvaluationPriority, functions, onFunctionCall, documentFunctionParams, maxParallelFunctionCalls, contextShift = defaultContextShiftOptions, customStopTriggers, abortOnNonText, lastEvaluationContextWindow: { history: lastEvaluationContextWindowHistory, minimumOverlapPercentageToPreventContextShift = 0.5 } = {} } = {}) {
        this.llamaChat = llamaChat;
        this.chatWrapper = chatWrapper;
        this.history = history;
        this.onTextChunk = safeEventCallback(onTextChunk);
        this.onToken = safeEventCallback(onToken);
        this.onResponseChunk = safeEventCallback(onResponseChunk);
        this.onFunctionCallParamsChunk = safeEventCallback(onFunctionCallParamsChunk);
        this.budgets = budgets;
        this.signal = signal;
        this.stopOnAbortSignal = stopOnAbortSignal;
        this.maxTokens = maxTokens;
        this.temperature = temperature;
        this.minP = minP;
        this.topK = topK;
        this.topP = topP;
        this.seed = seed;
        this.grammar = grammar;
        this.trimWhitespaceSuffix = trimWhitespaceSuffix;
        this.tokenBias = tokenBias;
        this.evaluationPriority = evaluationPriority;
        this.functions = functions;
        this.onFunctionCall = safeEventCallback(onFunctionCall);
        this.documentFunctionParams = documentFunctionParams;
        this.maxParallelFunctionCalls = maxParallelFunctionCalls;
        this.contextShift = contextShift;
        this.customStopTriggers = customStopTriggers;
        this.abortOnNonText = abortOnNonText ?? false;
        this.minimumOverlapPercentageToPreventContextShift = minimumOverlapPercentageToPreventContextShift;
        this.functionsEnabled = (this.functions != null && Object.keys(this.functions).length > 0);
        if (this.signal?.aborted)
            throw this.signal.reason;
        if (this.llamaChat.disposed)
            throw new DisposedError();
        this.noRawInResolvedHistory = !this.llamaChat.sequence.isLoadedToMemory;
        this.resolvedHistory = this.noRawInResolvedHistory
            ? this.history.map(removeRawFromHistoryItem)
            : this.history.slice();
        this.resolvedContextShift = {
            ...defaultContextShiftOptions,
            ...removeNullFields(this.contextShift)
        };
        this.resolvedRepeatPenalty = repeatPenalty === false
            ? { lastTokens: 0 }
            : {
                ...(repeatPenalty ?? {}),
                lastTokens: repeatPenalty?.lastTokens ?? defaultRepeatPenaltyLastTokens
            };
        this.repeatPenaltyEnabled = this.resolvedRepeatPenalty.lastTokens > 0;
        this.grammarEvaluationState = this.grammar != null
            ? new LlamaGrammarEvaluationState({ model: this.llamaChat.model, grammar: this.grammar })
            : undefined;
        this.functionNameGrammar = this.functionsEnabled
            ? new FunctionCallNameGrammar(this.llamaChat.model._llama, this.functions, this.chatWrapper)
            : undefined;
        this.functionsGrammar = undefined;
        this.functionsEvaluationState = undefined;
        this.lastContextWindowHistory = lastEvaluationContextWindowHistory ?? this.resolvedHistory;
        this.lastHistoryCompressionMetadata = this.resolvedContextShift.lastEvaluationMetadata;
        if (this.customStopTriggers != null)
            StopGenerationDetector.resolveStopTriggers(this.customStopTriggers, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.customStopGenerationTriggersDetector.addStopTrigger(stopTrigger));
        if (this.grammar != null)
            StopGenerationDetector.resolveStopTriggers(this.grammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.stopGenerationDetector.addStopTrigger(stopTrigger));
        if (this.functions != null && Object.keys(this.functions).length > 0 && !this.abortOnNonText)
            this.functionSyntaxStartDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText([
                this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix ?? "",
                this.chatWrapper.settings.functions.call.prefix
            ]), this.llamaChat.model.tokenizer));
        const segmentDefinitions = new Map();
        for (const segmentType of allSegmentTypes) {
            const segmentDefinition = getChatWrapperSegmentDefinition(this.chatWrapper.settings, segmentType);
            if (segmentDefinition != null)
                segmentDefinitions.set(segmentType, segmentDefinition);
        }
        const lastModelMessageFullResponse = getLastModelMessageFullResponseFromChatHistory(this.resolvedHistory);
        this.segmentHandler = new SegmentHandler({
            model: this.llamaChat.model,
            onTextChunk: this.onTextChunk,
            onToken: this.onToken,
            onResponseChunk: this.onResponseChunk,
            previousTokens: this.getLastTokens(),
            closeAllSegments: this.chatWrapper.settings.segments?.closeAllSegments,
            segmentDefinitions,
            initialSegmentStack: SegmentHandler.getStackFromModelResponse(lastModelMessageFullResponse),
            initialTokenCounts: this.budgets?.includeCurrentResponse === false
                ? new Map()
                : SegmentHandler.getSegmentTokenCounts(lastModelMessageFullResponse, this.llamaChat.model.tokenizer)
        });
        if (this.abortOnNonText) {
            this.stopGenerationDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText([
                this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix ?? "",
                this.chatWrapper.settings.functions.call.prefix
            ]), this.llamaChat.model.tokenizer));
            for (const segmentType of allSegmentTypes) {
                const segmentDefinition = getChatWrapperSegmentDefinition(this.chatWrapper.settings, segmentType);
                if (segmentDefinition != null)
                    this.stopGenerationDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(segmentDefinition.prefix), this.llamaChat.model.tokenizer));
            }
        }
        this.getPenaltyTokens = this.getPenaltyTokens.bind(this);
    }
    async dispose() {
        await this.evaluationIterator?.return();
    }
    async [Symbol.asyncDispose]() {
        await this.dispose();
    }
    ensureLastHistoryItemIsModel() {
        if (this.resolvedHistory.at(-1)?.type !== "model")
            this.resolvedHistory.push({
                type: "model",
                response: []
            });
    }
    ensureLastHistoryItemIsUser() {
        if (this.resolvedHistory.at(-1)?.type !== "user")
            this.resolvedHistory.push({
                type: "user",
                text: ""
            });
    }
    ensureReopenedThoughtSegmentAfterFunctionCallsIfNeeded() {
        if (this.chatWrapper.settings.segments?.thought?.reopenAfterFunctionCalls !== true)
            return;
        const lastModelResponseItem = this.resolvedHistory.at(-1);
        if (lastModelResponseItem == null || lastModelResponseItem.type !== "model")
            return;
        const lastResponse = lastModelResponseItem.response.at(-1);
        if (lastResponse == null)
            return;
        const lastResponseIsFunctionCall = typeof lastResponse !== "string" && lastResponse.type === "functionCall";
        if (!lastResponseIsFunctionCall)
            return;
        const currentResponseSegmentsStack = SegmentHandler.getStackFromModelResponse(lastModelResponseItem.response);
        if (currentResponseSegmentsStack.includes("thought"))
            return;
        const hadThoughtSegments = this.resolvedHistory.some((chatItem) => {
            if (chatItem.type !== "model")
                return false;
            return chatItem.response.some((responseItem) => {
                if (typeof responseItem === "string")
                    return false;
                return responseItem.type === "segment" && responseItem.segmentType === "thought";
            });
        });
        if (!hadThoughtSegments)
            return;
        if (this.abortOnNonText)
            this.shouldAbortBecauseOfNonText = true;
        else
            this.segmentHandler.openSegment("thought");
    }
    ensureNotAborted() {
        if (this.signal?.aborted && (!this.stopOnAbortSignal || this.res.length === 0))
            throw this.signal.reason;
        if (this.llamaChat.disposed)
            throw new DisposedError();
    }
    getPenaltyTokens() {
        if (this.llamaChat.disposed)
            return [];
        let punishTokens = this.res.slice(-this.resolvedRepeatPenalty.lastTokens);
        if (this.resolvedRepeatPenalty.punishTokensFilter != null)
            punishTokens = this.resolvedRepeatPenalty.punishTokensFilter(punishTokens);
        if (this.resolvedRepeatPenalty.penalizeNewLine == null || !this.resolvedRepeatPenalty.penalizeNewLine) {
            const nlToken = this.llamaChat.model.tokens.nl;
            if (nlToken != null)
                punishTokens = punishTokens.filter((token) => token !== nlToken);
        }
        return punishTokens;
    }
    getResolvedHistoryWithCurrentModelResponse() {
        return mergeGeneratedResultWithChatHistory("model", this.resolvedHistory, this.segmentHandler.getModelResponseSegments());
    }
    getContextWindowsHistoryWithCurrentModelResponse() {
        return mergeGeneratedResultWithChatHistory("model", this.lastContextWindowHistory, this.segmentHandler.getContextWindowModelResponseSegments());
    }
    removeFoundStartIgnoreTextsFromPendingTokens(forceRemove = false) {
        if (!this.removedStartTextToIgnore && this.res.length === 0 && this.pendingTokens.length > 0 &&
            this.ignoreStartTextDetector.hasTriggeredStops && (forceRemove || !this.ignoreStartTextDetector.hasInProgressStops)) {
            this.ignoreStartTextDetector.clearInProgressStops();
            this.ignoreStartTextDetector.clearTriggeredStops();
            let mostExhaustiveTriggeredStops = null;
            let mostExhaustiveTriggeredStopsLeftoverTokens = [];
            const lastTokensForDetokenizer = resolveLastTokens([
                this.contextWindowTokens,
                this.ignoredStartTextTokens,
                this.prefixTriggerTokens
            ]);
            const pendingPartialTokens = [];
            for (let i = 0; i < this.pendingTokens.length; i++) {
                const currentToken = this.pendingTokens[i];
                const tokens = [...pendingPartialTokens, currentToken];
                const text = this.llamaChat.model.detokenize(tokens, false, lastTokensForDetokenizer);
                if (pendingPartialTokens.length === 0 &&
                    text.endsWith(UNKNOWN_UNICODE_CHAR) &&
                    !this.llamaChat.model.isSpecialToken(currentToken) &&
                    !this.llamaChat.model.isEogToken(currentToken)) {
                    pendingPartialTokens.length = 0;
                    pushAll(pendingPartialTokens, tokens);
                    continue;
                }
                this.ignoreStartTextDetector.recordGeneration({
                    text: this.llamaChat.model.detokenize(tokens, false, lastTokensForDetokenizer),
                    tokens,
                    startNewChecks: i === 0,
                    triggerMustStartWithGeneration: true
                });
                pushAll(lastTokensForDetokenizer, tokens);
                if (this.ignoreStartTextDetector.hasTriggeredStops) {
                    mostExhaustiveTriggeredStops = this.ignoreStartTextDetector.getTriggeredStops();
                    this.ignoreStartTextDetector.clearTriggeredStops();
                    mostExhaustiveTriggeredStopsLeftoverTokens = this.pendingTokens.slice(i + 1);
                }
                else if (!this.ignoreStartTextDetector.hasInProgressStops)
                    break;
            }
            if (mostExhaustiveTriggeredStops != null) {
                const [mostExhaustiveTriggeredStop] = mostExhaustiveTriggeredStops;
                if (mostExhaustiveTriggeredStop != null) {
                    this.ignoredStartTextTokens = mostExhaustiveTriggeredStop.stopTrigger
                        .map((stopTrigger) => {
                        if (typeof stopTrigger === "string")
                            return this.llamaChat.model.tokenize(stopTrigger, false, "trimLeadingSpace");
                        else
                            return [stopTrigger];
                    })
                        .flat(1);
                    const newPendingTokens = [
                        ...mostExhaustiveTriggeredStop.remainingGeneration,
                        mostExhaustiveTriggeredStopsLeftoverTokens
                    ]
                        .map((generation) => {
                        if (typeof generation === "string")
                            return this.llamaChat.model.tokenize(generation, false, "trimLeadingSpace");
                        else
                            return generation;
                    })
                        .flat(1);
                    this.pendingTokens.length = 0;
                    pushAll(this.pendingTokens, newPendingTokens);
                    this.removedStartTextToIgnore = true;
                }
            }
        }
    }
    startTokenLoop() {
        this.ensureNotAborted();
        this.shouldContextShift = false;
    }
    handleRerender() {
        if (this.shouldRerender) {
            this.isRerender = true;
            this.streamRegulator.reset();
            if (this.rerenderActions === "closeResponseItem" && this.segmentHandler.topOpenSegmentType != null &&
                !this.skipClosingResponseItemOnRerender) {
                this.segmentHandler.closeSegment(this.segmentHandler.topOpenSegmentType);
                this.shouldRerender = false;
            }
            this.skipClosingResponseItemOnRerender = false;
        }
    }
    getContextWindowFunctionCallsTokens() {
        if (this.functionEvaluationMode === false)
            return [];
        else if (this.functionEvaluationMode === "prefixOrDisengage")
            return [
                ...LlamaText(this.currentFunctionCallPreviousText).tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace"),
                ...this.currentFunctionCallCurrentPartTokens
            ];
        const text = [];
        if (this.chatWrapper.settings.functions?.parallelism?.call?.sectionPrefix != null)
            text.push(this.chatWrapper.settings.functions.parallelism.call.sectionPrefix);
        for (let i = 0; i < this.resFunctionCalls.length; i++) {
            const call = this.resFunctionCalls[i];
            if (i > 0)
                text.push(this.chatWrapper.settings.functions?.parallelism?.call?.betweenCalls ?? "");
            text.push(call.raw);
        }
        text.push(this.currentFunctionCallPreviousText);
        return [
            ...LlamaText(text).tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace"),
            ...this.currentFunctionCallCurrentPartTokens
        ];
    }
    async loadContextWindow(resolvedHistory, resolvedContextWindowsHistory, endWithUserText = false, avoidReloadingHistory = false) {
        const queuedChunkTokens = this.streamRegulator.getAllQueuedChunkTokens();
        const functionCallsTokens = this.getContextWindowFunctionCallsTokens();
        if (!avoidReloadingHistory || !this.canAvoidReloadingHistory || this.isRerender || !this.llamaChat.sequence.isLoadedToMemory) {
            const { history: contextWindowHistory, stopGenerationTriggers, tokens: contextWindowTokens, removeRawFromHistory, newHistoryCompressionMetadata, ignoreStartText, functionCallInitiallyEngaged, disengageInitiallyEngagedFunctionCall, userTextSuffix, prefixTriggers, noPrefixTrigger, rerender, detectFunctionCalls } = await getContextWindow({
                resolvedHistory: resolvedHistory,
                resolvedContextShift: this.resolvedContextShift,
                lastHistoryCompressionMetadata: this.lastHistoryCompressionMetadata,
                pendingTokensCount: this.prefixTriggerTokens.length + this.pendingTokens.length + queuedChunkTokens.length +
                    functionCallsTokens.length + this.pendingPartialTokens.length,
                isFirstEvaluation: this.isFirstEvaluation,
                isRerender: this.isRerender,
                chatWrapper: this.chatWrapper,
                lastEvaluationContextWindowHistory: resolvedContextWindowsHistory,
                minimumOverlapPercentageToPreventContextShift: this.minimumOverlapPercentageToPreventContextShift,
                sequence: this.llamaChat.sequence,
                minFreeContextTokens: 1,
                functions: this.functionsEnabled ? this.functions : undefined,
                documentFunctionParams: this.documentFunctionParams,
                endWithUserText
            });
            this.ensureNotAborted();
            this.contextWindowTokens = contextWindowTokens;
            this.stopGenerationTriggers = stopGenerationTriggers;
            this.ignoreStartText = ignoreStartText;
            this.functionCallInitiallyEngaged = functionCallInitiallyEngaged;
            this.disengageInitiallyEngagedFunctionCall = disengageInitiallyEngagedFunctionCall;
            this.userTextSuffix = userTextSuffix;
            if (this.isRerender) {
                this.prefixTriggerTokens.length = 0;
                for (const prefixDetector of this.prefixTriggerDetectors.keys()) {
                    prefixDetector.clearInProgressStops();
                    prefixDetector.clearTriggeredStops();
                }
                this.prefixTriggerDetectors.clear();
                for (const trigger of prefixTriggers ?? []) {
                    const segmentBudget = trigger.type === "segment"
                        ? this.getSegmentBudget(trigger.segmentType)
                        : null;
                    if (trigger.type === "functionCall" && !this.functionsEnabled)
                        continue;
                    else if (trigger.type === "segment" &&
                        segmentBudget != null &&
                        !this.segmentHandler.isSegmentTypeOpen(trigger.segmentType) &&
                        this.segmentHandler.getSegmentTokensCount(trigger.segmentType) >= segmentBudget)
                        continue;
                    const prefixDetector = new StopGenerationDetector();
                    StopGenerationDetector.resolveStopTriggers(trigger.triggers, this.llamaChat.model.tokenizer)
                        .forEach((stopTrigger) => prefixDetector.addStopTrigger(stopTrigger));
                    this.prefixTriggerDetectors.set(prefixDetector, { inject: trigger.inject, trigger });
                    const inject = trigger.inject;
                    if (inject != null && inject.values.length > 0) {
                        const fullPrefixDetector = new StopGenerationDetector();
                        StopGenerationDetector
                            .resolveStopTriggers(trigger.triggers.map((trigger) => LlamaText([trigger, inject])), this.llamaChat.model.tokenizer)
                            .forEach((stopTrigger) => fullPrefixDetector.addStopTrigger(stopTrigger));
                        this.prefixTriggerDetectors.set(fullPrefixDetector, { trigger });
                    }
                }
                this.noPrefixTrigger = noPrefixTrigger;
                const noPrefixTriggerSegmentBudget = noPrefixTrigger?.type === "segment"
                    ? this.getSegmentBudget(noPrefixTrigger.segmentType)
                    : null;
                if (this.noPrefixTrigger?.type === "functionCall" && !this.functionsEnabled)
                    this.noPrefixTrigger = undefined;
                else if (noPrefixTrigger?.type === "segment" &&
                    noPrefixTriggerSegmentBudget != null &&
                    !this.segmentHandler.isSegmentTypeOpen(noPrefixTrigger.segmentType) &&
                    this.segmentHandler.getSegmentTokensCount(noPrefixTrigger.segmentType) >= noPrefixTriggerSegmentBudget)
                    this.noPrefixTrigger = undefined;
                this.rerenderTriggers = rerender?.triggers ?? [];
                this.rerenderTriggerDetector.clearInProgressStops();
                this.rerenderTriggerDetector.clearTriggeredStops();
                this.rerenderTriggerDetector = new StopGenerationDetector();
                this.rerenderActions = rerender?.action;
                this.functionSyntaxStartDetectorEnabled = detectFunctionCalls ?? true;
                if (!this.functionSyntaxStartDetectorEnabled)
                    this.functionSyntaxStartDetector.clearInProgressStops();
                if (rerender?.triggers != null) {
                    StopGenerationDetector.resolveStopTriggers(rerender.triggers, this.llamaChat.model.tokenizer)
                        .map((stopTrigger) => this.rerenderTriggerDetector.addStopTrigger(stopTrigger));
                }
            }
            this.lastHistoryCompressionMetadata = newHistoryCompressionMetadata;
            this.lastContextWindowHistory = contextWindowHistory;
            this.segmentHandler.resetContextWindow();
            this.canAvoidReloadingHistory = true;
            if (removeRawFromHistory && !this.noRawInResolvedHistory) {
                this.noRawInResolvedHistory = true;
                this.resolvedHistory = this.resolvedHistory.map(removeRawFromHistoryItem);
            }
        }
        this.tokens = [
            ...this.contextWindowTokens,
            ...this.ignoredStartTextTokens,
            ...this.prefixTriggerTokens,
            ...this.pendingTokens,
            ...queuedChunkTokens,
            ...functionCallsTokens,
            ...this.pendingPartialTokens
        ];
        if (avoidReloadingHistory && this.tokens.length >= this.llamaChat.sequence.context.contextSize - 1)
            return await this.loadContextWindow(resolvedHistory, resolvedContextWindowsHistory, endWithUserText, false);
        return {
            userTextSuffix: this.userTextSuffix
        };
    }
    addIgnoreStartTextTriggersFromChatWrapper() {
        StopGenerationDetector.resolveStopTriggers(this.ignoreStartText, this.llamaChat.model.tokenizer)
            .map((stopTrigger) => this.ignoreStartTextDetector.addStopTrigger(stopTrigger));
    }
    addStopGenerationTriggersFromChatWrapper() {
        StopGenerationDetector.resolveStopTriggers(this.stopGenerationTriggers, this.llamaChat.model.tokenizer)
            .map((stopTrigger) => this.stopGenerationDetector.addStopTrigger(stopTrigger));
    }
    initFunctions() {
        this.initiallyEngagedFunctionMode = this.functionCallInitiallyEngaged;
        if (this.initiallyEngagedFunctionMode && this.abortOnNonText) {
            this.shouldAbortBecauseOfNonText = true;
            return;
        }
        if (this.initiallyEngagedFunctionMode) {
            StopGenerationDetector.resolveStopTriggers(this.disengageInitiallyEngagedFunctionCall, this.llamaChat.model.tokenizer)
                .map((stopTrigger) => this.disengageInitiallyEngagedFunctionMode.addStopTrigger(stopTrigger));
            if (this.disengageInitiallyEngagedFunctionMode.hasTriggers) {
                this.functionEvaluationMode = "prefixOrDisengage";
                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
            }
            else {
                this.functionEvaluationMode = "functionName";
            }
            this.restartEvaluationIterator = true;
        }
    }
    async handlePrefixTriggers(loadContextWindow) {
        const reloadTokens = async () => {
            this.startTokenLoop();
            await loadContextWindow();
        };
        const injectTokens = async (text, alignStateTokens = false) => {
            if (text == null)
                return;
            const tokens = text.tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace");
            if (tokens.length === 0)
                return;
            pushAll(this.prefixTriggerTokens, tokens);
            if (alignStateTokens)
                await reloadTokens();
        };
        if (this.prefixTriggerDetectors.size === 0) {
            if (this.abortOnNonText && this.noPrefixTrigger != null && this.noPrefixTrigger.type !== "response") {
                this.shouldAbortBecauseOfNonText = true;
                const stopRes = this.handleAbortTrigger("model");
                if (stopRes != null)
                    return stopRes;
                return undefined;
            }
            if (this.noPrefixTrigger?.type === "functionCall" && this.chatWrapper.settings.functions != null) {
                await injectTokens(this.noPrefixTrigger.inject, true);
                this.functionEvaluationMode = "functionName";
            }
            else if (this.noPrefixTrigger?.type === "segment") {
                await injectTokens(this.noPrefixTrigger.inject, true);
                this.segmentHandler.openSegment(this.noPrefixTrigger.segmentType);
            }
            else if (this.noPrefixTrigger?.type === "response")
                await injectTokens(this.noPrefixTrigger.inject, true);
            return undefined;
        }
        const generatedTokens = [];
        let isFirstToken = true;
        let continueGeneration = true;
        for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
            pushAll(generatedTokens, tokens);
            for (const [triggerDetector, { trigger, inject }] of [...this.prefixTriggerDetectors.entries()]) {
                triggerDetector.recordGeneration({
                    text: this.currentText,
                    tokens: this.currentTokens,
                    startNewChecks: isFirstToken,
                    triggerMustStartWithGeneration: true
                });
                if (triggerDetector.hasTriggeredStops) {
                    const { firstRemainingGenerationAfterStop, stopTrigger } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggerDetector.getTriggeredStops());
                    const remainingTokens = typeof firstRemainingGenerationAfterStop === "string"
                        ? firstRemainingGenerationAfterStop === ""
                            ? []
                            : this.llamaChat.model.tokenize(firstRemainingGenerationAfterStop, false, "trimLeadingSpace")
                        : (firstRemainingGenerationAfterStop ?? []);
                    const triggerTokens = (stopTrigger == null || remainingTokens.length === 0)
                        ? generatedTokens
                        : stopTrigger.flatMap((item) => {
                            if (typeof item === "string")
                                return this.llamaChat.model.tokenize(item, false, "trimLeadingSpace");
                            return [item];
                        });
                    if (this.abortOnNonText && trigger.type !== "response") {
                        this.shouldAbortBecauseOfNonText = true;
                        const stopRes = this.handleAbortTrigger("model");
                        if (stopRes != null)
                            return stopRes;
                        return undefined;
                    }
                    this.streamRegulator.reset();
                    if (trigger.type === "segment") {
                        pushAll(this.prefixTriggerTokens, triggerTokens);
                        if (inject != null)
                            await injectTokens(inject);
                        await reloadTokens();
                        this.segmentHandler.openSegment(trigger.segmentType);
                    }
                    else if (trigger.type === "response") {
                        pushAll(this.prefixTriggerTokens, triggerTokens);
                        if (inject != null)
                            await injectTokens(inject);
                        await reloadTokens();
                    }
                    else if (trigger.type === "functionCall") {
                        if (trigger.replaceTrigger === false)
                            pushAll(this.prefixTriggerTokens, triggerTokens);
                        if (inject != null)
                            await injectTokens(inject);
                        await reloadTokens();
                        this.functionEvaluationMode = "functionName";
                    }
                    else
                        void trigger;
                    this.prefixTriggerDetectors.clear();
                    continueGeneration = false;
                    break;
                }
                else if (!triggerDetector.hasInProgressStops)
                    this.prefixTriggerDetectors.delete(triggerDetector);
            }
            if (this.prefixTriggerDetectors.size === 0 && continueGeneration) {
                if (this.abortOnNonText && this.noPrefixTrigger != null && this.noPrefixTrigger.type !== "response") {
                    this.shouldAbortBecauseOfNonText = true;
                    const stopRes = this.handleAbortTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                    return undefined;
                }
                this.streamRegulator.reset();
                continueGeneration = false;
                if (this.noPrefixTrigger?.type === "functionCall" && this.chatWrapper.settings.functions != null) {
                    await injectTokens(this.noPrefixTrigger.inject, true);
                    this.functionEvaluationMode = "functionName";
                }
                else if (this.noPrefixTrigger?.type === "segment") {
                    await injectTokens(this.noPrefixTrigger.inject, true);
                    this.segmentHandler.openSegment(this.noPrefixTrigger.segmentType);
                }
                else if (this.noPrefixTrigger?.type === "response")
                    await injectTokens(this.noPrefixTrigger.inject, true);
                else
                    this.streamRegulator.addChunk({
                        tokens: generatedTokens,
                        text: this.llamaChat.model.detokenize(generatedTokens, false, this.getLastTokens())
                    });
            }
            isFirstToken = false;
            if (!continueGeneration)
                break;
            const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
            if (stopRes != null)
                return stopRes;
        }
        return undefined;
    }
    async enterFunctionCallingLoop(loadContextWindow) {
        if (!this.functionsEnabled) {
            this.functionEvaluationMode = false;
            return undefined;
        }
        while (true) {
            if (this.functionEvaluationMode === "prefixOrDisengage") {
                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                const prefixTokens = LlamaText(this.chatWrapper.settings.functions.call.prefix)
                    .tokenize(this.llamaChat.model.tokenizer, "trimLeadingSpace");
                const prefixDetector = new StopGenerationDetector();
                const prefixDetectorRecordedTokens = [];
                const afterPrefixLeftoverTokens = [];
                prefixDetector.addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(this.chatWrapper.settings.functions.call.prefix), this.llamaChat.model.tokenizer));
                const lastTokensForDetokenizer = this.streamRegulator.getLastQueuedChunkTokens();
                for (const prefixToken of prefixTokens) {
                    const tokens = [prefixToken];
                    const text = this.llamaChat.model.detokenize(tokens, false, lastTokensForDetokenizer);
                    pushAll(lastTokensForDetokenizer, tokens);
                    const disregardedPossibilities = this.disengageInitiallyEngagedFunctionMode
                        .getDisregardedPossibilitiesCountForAGeneration({
                        text,
                        tokens,
                        startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 0
                    });
                    if (disregardedPossibilities > 0)
                        break;
                    this.currentFunctionCallCurrentPartTokens.push(prefixToken);
                    this.disengageInitiallyEngagedFunctionMode.recordGeneration({
                        text: text,
                        tokens: tokens,
                        startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                        triggerMustStartWithGeneration: true
                    });
                    if (prefixDetector.hasTriggeredStops)
                        afterPrefixLeftoverTokens.push(prefixToken);
                    else {
                        prefixDetector.recordGeneration({
                            text: text,
                            tokens: tokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === 1,
                            triggerMustStartWithGeneration: true
                        });
                        pushAll(prefixDetectorRecordedTokens, tokens);
                    }
                }
                for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                    const stopGenerationTriggerRes = this.handleStopGenerationTrigger("model");
                    if (stopGenerationTriggerRes != null)
                        return stopGenerationTriggerRes;
                    pushAll(this.currentFunctionCallCurrentPartTokens, tokens);
                    this.disengageInitiallyEngagedFunctionMode.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens,
                        startNewChecks: this.currentFunctionCallCurrentPartTokens.length === tokens.length,
                        triggerMustStartWithGeneration: true
                    });
                    if (prefixDetector.hasTriggeredStops)
                        pushAll(afterPrefixLeftoverTokens, tokens);
                    else {
                        prefixDetector.recordGeneration({
                            text: this.currentText,
                            tokens: this.currentTokens,
                            startNewChecks: this.currentFunctionCallCurrentPartTokens.length === tokens.length,
                            triggerMustStartWithGeneration: true
                        });
                        pushAll(prefixDetectorRecordedTokens, this.currentTokens);
                    }
                    if (this.disengageInitiallyEngagedFunctionMode.hasTriggeredStops ||
                        !this.disengageInitiallyEngagedFunctionMode.hasInProgressStops)
                        break;
                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                }
                const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                if (stopRes != null)
                    return stopRes;
                if (this.disengageInitiallyEngagedFunctionMode.hasTriggeredStops) {
                    const lastTokensForDetokenizer = this.streamRegulator.getLastQueuedChunkTokens();
                    for (const token of this.currentFunctionCallCurrentPartTokens) {
                        this.currentToken = token;
                        this.currentTokens = [this.currentToken];
                        this.currentText = this.llamaChat.model.detokenize(this.currentTokens, false, lastTokensForDetokenizer);
                        pushAll(lastTokensForDetokenizer, this.currentTokens);
                        this.currentQueuedTokenRelease = this.streamRegulator.addChunk({
                            tokens: this.currentTokens,
                            text: this.currentText
                        });
                        this.recordStopGenerationEvaluation();
                    }
                    this.currentFunctionCallCurrentPartTokens.length = 0;
                    this.functionEvaluationMode = false;
                    return undefined;
                }
                if (prefixDetector.hasTriggeredStops) {
                    const triggeredStops = prefixDetector.getTriggeredStops();
                    const { firstRemainingGenerationAfterStop, stopTrigger } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
                    this.currentFunctionCallPreviousPartLeftoverText = StopGenerationDetector.detokenizeRemainingGeneration(firstRemainingGenerationAfterStop, stopTrigger, this.llamaChat.model.tokenizer) + this.llamaChat.model.detokenize(afterPrefixLeftoverTokens, false, prefixDetectorRecordedTokens);
                }
                else
                    this.currentFunctionCallPreviousPartLeftoverText = "";
                this.functionEvaluationMode = "functionName";
                this.currentFunctionCallCurrentPartTokens.length = 0;
                continue;
            }
            else if (this.functionEvaluationMode === "functionName") {
                const functionNameGenerationDoneDetector = new StopGenerationDetector();
                this.stopGenerationDetector.clearInProgressStops();
                this.customStopGenerationTriggersDetector.clearInProgressStops();
                this.currentFunctionCallPreviousText = LlamaText(this.chatWrapper.settings.functions.call.prefix);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                const functionNameGrammar = this.functionNameGrammar ?? new FunctionCallNameGrammar(this.llamaChat.model._llama, this.functions, this.chatWrapper);
                this.functionsGrammar = functionNameGrammar;
                this.functionsEvaluationState = new LlamaGrammarEvaluationState({
                    model: this.llamaChat.model,
                    grammar: this.functionsGrammar
                });
                StopGenerationDetector.resolveStopTriggers(this.functionsGrammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                    .map((stopTrigger) => functionNameGenerationDoneDetector.addStopTrigger(stopTrigger));
                if (this.currentFunctionCallPreviousPartLeftoverText !== "") {
                    const validFunctionNames = Object.keys(this.functions);
                    const hasAnyFunctionStartWithLeftover = validFunctionNames.some((functionName) => functionName.startsWith(this.currentFunctionCallPreviousPartLeftoverText));
                    if (hasAnyFunctionStartWithLeftover) {
                        const leftoverTokens = this.llamaChat.model.tokenize(this.currentFunctionCallPreviousPartLeftoverText, false, "trimLeadingSpace");
                        this.currentFunctionCallPreviousPartLeftoverText = "";
                        const lastTokens = [];
                        for (const leftoverToken of leftoverTokens) {
                            const canBeNextToken = LlamaSampler._canBeNextTokenForGrammarEvaluationState(this.llamaChat.model._llama, this.functionsEvaluationState, leftoverToken);
                            if (!canBeNextToken)
                                break;
                            LlamaSampler._acceptTokenOnGrammarEvaluationState(this.llamaChat.model._llama, this.functionsEvaluationState, leftoverToken);
                            this.currentFunctionCallCurrentPartTokens.push(leftoverToken);
                            functionNameGenerationDoneDetector.recordGeneration({
                                text: this.llamaChat.model.detokenize([leftoverToken], false, lastTokens),
                                tokens: [leftoverToken]
                            });
                            lastTokens.push(leftoverToken);
                        }
                    }
                }
                for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                    pushAll(this.currentFunctionCallCurrentPartTokens, tokens);
                    functionNameGenerationDoneDetector.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens
                    });
                    if (functionNameGenerationDoneDetector.hasTriggeredStops)
                        break;
                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                }
                const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                if (stopRes != null)
                    return stopRes;
                const functionCallNameText = this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens);
                const functionName = functionNameGrammar.parseFunctionName(functionCallNameText);
                this.functionEvaluationFunctionName = functionName;
                this.functionEvaluationMode = "params";
                continue;
            }
            else if (this.functionEvaluationMode === "params") {
                this.currentFunctionCallPreviousText = LlamaText([
                    this.chatWrapper.settings.functions.call.prefix,
                    this.functionEvaluationFunctionName,
                    this.chatWrapper.settings.functions.call.paramsPrefix
                ]);
                const lastPartTokens = resolveLastTokens([this.currentFunctionCallCurrentPartTokens]);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                let params = undefined;
                let paramsText = "";
                const functionDefinition = this.functions[this.functionEvaluationFunctionName];
                if (functionDefinition == null)
                    throw new Error(`Function "${this.functionEvaluationFunctionName}" is not provided in the functions object`);
                else if (functionDefinition.params == null) {
                    const emptyCallParamsPlaceholder = this.chatWrapper.settings?.functions?.call?.emptyCallParamsPlaceholder;
                    if (emptyCallParamsPlaceholder !== undefined && emptyCallParamsPlaceholder !== "") {
                        params = structuredClone(emptyCallParamsPlaceholder);
                        paramsText = jsonDumps(params);
                        pushAll(this.currentFunctionCallCurrentPartTokens, this.llamaChat.model.tokenize(paramsText));
                    }
                    else {
                        params = undefined;
                        paramsText = "";
                    }
                }
                else {
                    const functionParamsGenerationDoneDetector = new StopGenerationDetector();
                    const functionParamsGrammar = new FunctionCallParamsGrammar(this.llamaChat.model._llama, this.functions, this.chatWrapper, this.functionEvaluationFunctionName, functionDefinition.params);
                    this.functionsGrammar = functionParamsGrammar;
                    this.functionsEvaluationState = new LlamaGrammarEvaluationState({
                        model: this.llamaChat.model,
                        grammar: this.functionsGrammar
                    });
                    StopGenerationDetector.resolveStopTriggers(this.functionsGrammar.stopGenerationTriggers, this.llamaChat.model.tokenizer)
                        .map((stopTrigger) => functionParamsGenerationDoneDetector.addStopTrigger(stopTrigger));
                    if (this.currentFunctionCallCurrentPartTokens.length > 0)
                        this.onFunctionCallParamsChunk?.({
                            callIndex: this.resFunctionCalls.length,
                            functionName: this.functionEvaluationFunctionName,
                            paramsChunk: this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens, false, lastPartTokens),
                            done: false
                        });
                    for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                        functionParamsGenerationDoneDetector.recordGeneration({
                            text: this.currentText,
                            tokens: this.currentTokens
                        });
                        this.onFunctionCallParamsChunk?.({
                            callIndex: this.resFunctionCalls.length,
                            functionName: this.functionEvaluationFunctionName,
                            paramsChunk: this.llamaChat.model.detokenize(tokens, false, resolveLastTokens([lastPartTokens, this.currentFunctionCallCurrentPartTokens])),
                            done: functionParamsGenerationDoneDetector.hasTriggeredStops
                        });
                        pushAll(this.currentFunctionCallCurrentPartTokens, tokens);
                        if (functionParamsGenerationDoneDetector.hasTriggeredStops)
                            break;
                        const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                        if (stopRes != null)
                            return stopRes;
                    }
                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                    const functionCallParamsText = this.llamaChat.model.detokenize(this.currentFunctionCallCurrentPartTokens, false, lastPartTokens);
                    const parsedFunctionParams = functionParamsGrammar.parseParams(functionCallParamsText);
                    params = parsedFunctionParams.params;
                    paramsText = parsedFunctionParams.raw;
                }
                const functionCallText = LlamaText([
                    this.chatWrapper.settings.functions.call.prefix,
                    this.functionEvaluationFunctionName,
                    this.chatWrapper.settings.functions.call.paramsPrefix,
                    paramsText,
                    this.chatWrapper.settings.functions.call.suffix
                ]);
                this.resFunctionCalls.push({
                    functionName: this.functionEvaluationFunctionName,
                    params,
                    raw: functionCallText
                });
                this.onFunctionCall?.({
                    functionName: this.functionEvaluationFunctionName,
                    params: structuredClone(params),
                    raw: functionCallText.toJSON()
                });
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                this.functionEvaluationFunctionName = "";
                if (this.chatWrapper.settings.functions.parallelism == null || (this.maxParallelFunctionCalls != null && this.maxParallelFunctionCalls <= this.resFunctionCalls.length)) {
                    this.functionEvaluationMode = false;
                    return this.returnFunctionCallResults();
                }
                this.functionEvaluationMode = "sectionSuffixOrBetweenCalls";
                continue;
            }
            else if (this.functionEvaluationMode === "sectionSuffixOrBetweenCalls") {
                const sectionSuffixDetector = new StopGenerationDetector();
                let isFirstToken = true;
                this.functionsGrammar = undefined;
                this.functionsEvaluationState = undefined;
                this.currentFunctionCallPreviousText = LlamaText([]);
                this.currentFunctionCallCurrentPartTokens.length = 0;
                StopGenerationDetector.resolveStopTriggers([
                    ...(this.chatWrapper.settings.functions.parallelism?.call?.sectionSuffix != null
                        ? [this.chatWrapper.settings.functions.parallelism?.call?.sectionSuffix]
                        : []),
                    LlamaText(new SpecialToken("EOS")),
                    LlamaText(new SpecialToken("EOT"))
                ], this.llamaChat.model.tokenizer)
                    .map((stopTrigger) => sectionSuffixDetector.addStopTrigger(stopTrigger));
                for await (const tokens of this.evaluateWithContextShift(loadContextWindow)) {
                    pushAll(this.currentFunctionCallCurrentPartTokens, tokens);
                    sectionSuffixDetector.recordGeneration({
                        text: this.currentText,
                        tokens: this.currentTokens,
                        startNewChecks: isFirstToken,
                        triggerMustStartWithGeneration: true
                    });
                    isFirstToken = false;
                    if (sectionSuffixDetector.hasTriggeredStops || !sectionSuffixDetector.hasInProgressStops)
                        break;
                    const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                    if (stopRes != null)
                        return stopRes;
                }
                const stopRes = this.handleAbortTrigger("model") ?? this.handleMaxTokensTrigger("model");
                if (stopRes != null)
                    return stopRes;
                if (sectionSuffixDetector.hasTriggeredStops) {
                    this.functionEvaluationMode = false;
                    return this.returnFunctionCallResults();
                }
                this.functionEvaluationMode = "functionName";
                this.initiallyEngagedFunctionMode = false;
                continue;
            }
            break;
        }
        return undefined;
    }
    releasePartiallyFreeTokensBeforeFunctionCallStart() {
        if (this.releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax)
            return;
        this.stopGenerationDetector.clearInProgressStops();
        this.customStopGenerationTriggersDetector.clearInProgressStops();
        pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());
        const triggeredStops = this.functionSyntaxStartDetector.getTriggeredStops();
        const partiallyFreeTokens = this.streamRegulator.getPartiallyFreeChunk(this.llamaChat.model.tokenizer);
        const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(triggeredStops, partiallyFreeTokens, this.llamaChat.model.tokenizer);
        pushAll(this.pendingTokens, queuedTokensBeforeStopTrigger);
        this.removeFoundStartIgnoreTextsFromPendingTokens(true);
        this.pushPendingTokensAndCallOnToken();
        this.streamRegulator.clearQueue();
        this.releasedPartiallyFreeTokensBeforeFunctionCallStartSyntax = true;
    }
    returnFunctionCallResults() {
        if (this.resFunctionCalls.length > 0) {
            this.releasePartiallyFreeTokensBeforeFunctionCallStart();
            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);
            return {
                response: responseSegments
                    .filter((segment) => typeof segment === "string")
                    .join(""),
                fullResponse: responseSegments,
                lastEvaluation: {
                    contextWindow: mergeGeneratedResultWithChatHistory("model", this.lastContextWindowHistory, this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)),
                    cleanHistory: mergeGeneratedResultWithChatHistory("model", this.resolvedHistory, responseSegments),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },
                functionCalls: this.resFunctionCalls.map((functionCall) => {
                    return {
                        functionName: functionCall.functionName,
                        params: functionCall.params,
                        raw: functionCall.raw.toJSON()
                    };
                }), // prevent infinite TS type instantiation
                metadata: {
                    stopReason: "functionCalls"
                }
            };
        }
        return undefined;
    }
    async *evaluateWithContextShift(loadContextWindow) {
        while (true) {
            this.startTokenLoop();
            await loadContextWindow();
            await this.alignCurrentSequenceStateWithCurrentTokens();
            await this.createNewEvaluationIterator();
            while (await this.iterateEvaluation()) {
                if (this.currentTokens.length === 0)
                    break;
                if (!this.holdPartialTokensForNextEvaluation())
                    yield this.currentTokens;
                if (this.shouldAbort)
                    return;
                if (this.updateShouldContextShift())
                    break;
                if (this.restartEvaluationIterator) {
                    await this.createNewEvaluationIterator();
                }
            }
            this.isFirstEvaluation = false;
            if (this.shouldContextShift)
                continue;
            break;
        }
        throw new Error("The context size is too small to generate a response");
    }
    async alignCurrentSequenceStateWithCurrentTokens() {
        if (this.tokens.length === 1 && this.llamaChat.sequence.nextTokenIndex !== 0) {
            await this.llamaChat.sequence.eraseContextTokenRanges([{
                    start: 0,
                    end: this.llamaChat.sequence.nextTokenIndex
                }]);
            return;
        }
        const lastToken = this.tokens[this.tokens.length - 1];
        // we need to decode at least one token to generate a response
        this.tokens.pop();
        await this.llamaChat.sequence.adaptStateToTokens(this.tokens, false);
        this.tokens.push(lastToken);
        this.ensureNotAborted();
        const firstDifferentIndex = this.llamaChat.sequence.nextTokenIndex;
        this.tokens.splice(0, firstDifferentIndex);
    }
    async evaluateWithoutGeneratingNewTokens() {
        if (this.evaluationIterator != null)
            await this.evaluationIterator.return();
        await this.llamaChat.sequence.evaluateWithoutGeneratingNewTokens(this.tokens, removeNullFields({
            evaluationPriority: this.evaluationPriority
        }));
    }
    async createNewEvaluationIterator() {
        if (this.evaluationIterator != null)
            await this.evaluationIterator.return();
        this.currentIterationReplacementToken = undefined;
        this.restartEvaluationIterator = false;
        this.evaluationIterator = this.llamaChat.sequence.evaluate(this.tokens, removeNullFields({
            temperature: this.temperature,
            minP: this.minP,
            topK: this.topK,
            topP: this.topP,
            seed: this.seed,
            grammarEvaluationState: () => {
                if (this.functionEvaluationMode !== false)
                    return this.functionsEvaluationState;
                return this.grammarEvaluationState;
            },
            repeatPenalty: !this.repeatPenaltyEnabled ? undefined : {
                punishTokens: this.getPenaltyTokens,
                maxPunishTokens: this.resolvedRepeatPenalty.lastTokens,
                penalty: this.resolvedRepeatPenalty.penalty,
                frequencyPenalty: this.resolvedRepeatPenalty.frequencyPenalty,
                presencePenalty: this.resolvedRepeatPenalty.presencePenalty
            },
            tokenBias: this.tokenBias,
            evaluationPriority: this.evaluationPriority,
            yieldEogToken: true
        }));
    }
    async iterateEvaluation() {
        this.currentIteration = await this.evaluationIterator?.next(this.currentIterationReplacementToken);
        this.currentIterationReplacementToken = undefined;
        this.ensureNotAborted();
        this.generatedTokens++;
        if ((this.currentIteration != null && this.currentIteration?.done !== true) || this.pendingPartialTokens.length !== 0) {
            this.currentToken = this.currentIteration?.value ?? undefined;
            this.currentTokens = this.currentToken != null
                ? this.pendingPartialTokens.length === 0
                    ? [this.currentToken]
                    : [...this.pendingPartialTokens, this.currentToken]
                : [...this.pendingPartialTokens];
            this.pendingPartialTokens.length = 0;
            this.currentText = this.llamaChat.model.detokenize(this.currentTokens, false, this.getLastTokens());
            if (this.functionEvaluationMode === false)
                this.currentQueuedTokenRelease = this.streamRegulator.addChunk({
                    tokens: this.currentTokens,
                    text: this.currentText
                });
            else
                this.currentQueuedTokenRelease = undefined;
            return true;
        }
        return false;
    }
    holdPartialTokensForNextEvaluation() {
        if (this.pendingPartialTokens.length === 0 &&
            this.currentText.endsWith(UNKNOWN_UNICODE_CHAR) &&
            this.currentToken != null &&
            !this.llamaChat.model.isSpecialToken(this.currentToken) &&
            !this.llamaChat.model.isEogToken(this.currentToken)) {
            this.pendingPartialTokens.length = 0;
            pushAll(this.pendingPartialTokens, this.currentTokens);
            this.streamRegulator.removeChunkIfLast(this.currentQueuedTokenRelease);
            return true;
        }
        return false;
    }
    waitOnPartialCharactersOrWhiteSpaceTokens() {
        if (this.currentText.endsWith(UNKNOWN_UNICODE_CHAR) || ((this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix) && this.currentText?.trim() === "") || (this.currentText === "" && this.locksToReleaseOnValidGeneration.length > 0 &&
            !this.llamaChat.model.isSpecialToken(this.currentToken))) {
            if (this.currentQueuedTokenRelease != null)
                this.locksToReleaseOnValidGeneration.push(this.currentQueuedTokenRelease.createTextIndexLock(0));
        }
        else {
            while (this.locksToReleaseOnValidGeneration.length > 0)
                this.locksToReleaseOnValidGeneration.shift().dispose();
        }
    }
    detectAndHandleFunctionStartSyntax() {
        if (!this.functionSyntaxStartDetectorEnabled)
            return;
        this.functionSyntaxStartDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });
        if (this.currentQueuedTokenRelease != null && this.functionEvaluationMode === false && this.functionsEnabled &&
            this.functionSyntaxStartDetector.hasTriggeredStops) {
            if (this.abortOnNonText) {
                this.shouldAbortBecauseOfNonText = true;
                return;
            }
            this.functionEvaluationMode = "functionName";
            this.currentQueuedTokenRelease.createTextIndexLock(0);
            this.stopGenerationDetector.clearTriggeredStops();
            this.stopGenerationDetector.clearInProgressStops();
            this.customStopGenerationTriggersDetector.clearTriggeredStops();
            this.customStopGenerationTriggersDetector.clearInProgressStops();
            pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());
            const triggeredStops = this.functionSyntaxStartDetector.getTriggeredStops();
            const partiallyFreeTokens = this.streamRegulator.getPartiallyFreeChunk(this.llamaChat.model.tokenizer);
            const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(triggeredStops, partiallyFreeTokens, this.llamaChat.model.tokenizer);
            pushAll(this.pendingTokens, queuedTokensBeforeStopTrigger);
            const { firstRemainingGenerationAfterStop, stopTrigger } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
            const remainingTextAfterStop = StopGenerationDetector.detokenizeRemainingGeneration(firstRemainingGenerationAfterStop, stopTrigger, this.llamaChat.model.tokenizer);
            this.currentFunctionCallPreviousPartLeftoverText = remainingTextAfterStop;
        }
    }
    recordStopGenerationEvaluation() {
        this.rerenderTriggerDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });
        this.stopGenerationDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });
        this.customStopGenerationTriggersDetector.recordGeneration({
            text: this.currentText,
            tokens: this.currentTokens,
            queuedTokenRelease: this.currentQueuedTokenRelease
        });
        if (this.llamaChat.model.isEogToken(this.currentToken))
            this.currentQueuedTokenRelease?.createTokenIndexLock(0);
    }
    popStreamRegulatorFreeTokens() {
        pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());
    }
    handleStopGenerationTrigger(lastHistoryItemType, forceStopReason) {
        const detectedStopGenerationTrigger = this.stopGenerationDetector.hasTriggeredStops ||
            this.customStopGenerationTriggersDetector.hasTriggeredStops ||
            this.llamaChat.model.isEogToken(this.currentToken);
        if ((detectedStopGenerationTrigger && !this.rerenderTriggerDetector.hasTriggeredStops) || forceStopReason != null) {
            this.stopGenerationDetector.clearInProgressStops();
            this.customStopGenerationTriggersDetector.clearInProgressStops();
            pushAll(this.pendingTokens, this.streamRegulator.popFreeChunkTokens());
            const triggeredStops = this.stopGenerationDetector.hasTriggeredStops
                ? this.stopGenerationDetector.getTriggeredStops()
                : this.customStopGenerationTriggersDetector.getTriggeredStops();
            const partiallyFreeTokens = this.streamRegulator.getPartiallyFreeChunk(this.llamaChat.model.tokenizer);
            const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(triggeredStops, partiallyFreeTokens, this.llamaChat.model.tokenizer);
            pushAll(this.pendingTokens, queuedTokensBeforeStopTrigger);
            const { firstRemainingGenerationAfterStop } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
            this.removeFoundStartIgnoreTextsFromPendingTokens(true);
            this.pushPendingTokensAndCallOnToken();
            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);
            const response = responseSegments
                .filter((segment) => typeof segment === "string")
                .join("");
            const lastEvaluation = {
                contextWindow: mergeGeneratedResultWithChatHistory(lastHistoryItemType, this.lastContextWindowHistory, this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)),
                cleanHistory: mergeGeneratedResultWithChatHistory(lastHistoryItemType, this.resolvedHistory, responseSegments),
                contextShiftMetadata: this.lastHistoryCompressionMetadata
            };
            const isEogToken = this.llamaChat.model.isEogToken(this.currentToken) || forceStopReason === "eogToken";
            if (isEogToken || this.stopGenerationDetector.hasTriggeredStops) {
                return {
                    response,
                    fullResponse: responseSegments,
                    lastEvaluation,
                    metadata: {
                        remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                        stopReason: isEogToken
                            ? "eogToken"
                            : "stopGenerationTrigger"
                    }
                };
            }
            return {
                response,
                fullResponse: responseSegments,
                lastEvaluation,
                metadata: {
                    remainingGenerationAfterStop: firstRemainingGenerationAfterStop,
                    stopReason: "customStopTrigger",
                    customStopTrigger: triggeredStops[0].stopTrigger
                }
            };
        }
        return undefined;
    }
    spliceIgnoreStartTextDetectedTokens() {
        if (this.res.length === 0) {
            this.ignoreStartTextDetector.clearInProgressStops();
            this.ignoreStartTextDetector.clearTriggeredStops();
            const lastTokensForDetokenizer = resolveLastTokens([
                this.contextWindowTokens,
                this.ignoredStartTextTokens
            ]);
            this.ignoreStartTextDetector.recordGeneration({
                text: this.llamaChat.model.detokenize(this.pendingTokens, false, lastTokensForDetokenizer),
                tokens: this.pendingTokens
            });
        }
    }
    isMaxTokensTriggered() {
        return this.maxTokens != null && this.maxTokens > 0 && this.generatedTokens >= this.maxTokens;
    }
    moveFreePendingTokensToRes(removeFoundStartIgnoreTextsFromPendingTokens = true) {
        if (this.pendingTokens.length > 0 && (this.isMaxTokensTriggered() || !this.ignoreStartTextDetector.hasInProgressStops)) {
            if (removeFoundStartIgnoreTextsFromPendingTokens)
                this.removeFoundStartIgnoreTextsFromPendingTokens();
            this.pushPendingTokensAndCallOnToken();
        }
    }
    handleMaxTokensTrigger(lastHistoryItemType) {
        if (this.isMaxTokensTriggered()) {
            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);
            return {
                response: responseSegments
                    .filter((segment) => typeof segment === "string")
                    .join(""),
                fullResponse: responseSegments,
                lastEvaluation: {
                    contextWindow: mergeGeneratedResultWithChatHistory(lastHistoryItemType, this.lastContextWindowHistory, this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)),
                    cleanHistory: mergeGeneratedResultWithChatHistory(lastHistoryItemType, this.resolvedHistory, responseSegments),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },
                metadata: {
                    stopReason: "maxTokens"
                }
            };
        }
        return undefined;
    }
    async handleBudgetTriggers() {
        let shouldReloadEvaluationState = false;
        if (this.budgets == null)
            return shouldReloadEvaluationState;
        for (const segmentType of this.segmentHandler.getOpenSegmentStack().reverse()) {
            const budget = this.getSegmentBudget(segmentType);
            if (budget == null)
                continue;
            const usedSegmentTokens = this.segmentHandler.getSegmentTokensCount(segmentType);
            if (usedSegmentTokens >= budget) {
                this.segmentHandler.closeSegment(segmentType);
                shouldReloadEvaluationState = true;
            }
        }
        return shouldReloadEvaluationState;
    }
    getSegmentBudget(segmentType) {
        const getBudget = (budget) => ((budget == null || budget === Infinity)
            ? null
            : budget);
        if (this.budgets == null)
            return null;
        if (segmentType === "thought")
            return getBudget(this.budgets.thoughtTokens);
        else if (segmentType === "comment")
            return getBudget(this.budgets.commentTokens);
        void segmentType;
        return null;
    }
    handleShouldRerender() {
        this.shouldRerender = this.rerenderTriggerDetector.hasTriggeredStops;
        if (this.abortOnNonText && this.shouldRerender)
            this.shouldAbortBecauseOfNonText = true;
        return this.shouldRerender;
    }
    updateShouldContextShift() {
        this.shouldContextShift = this.llamaChat.sequence.nextTokenIndex >= this.llamaChat.context.contextSize - 1;
        return this.shouldContextShift;
    }
    get shouldAbort() {
        return !!(this.signal?.aborted && this.stopOnAbortSignal) || this.shouldAbortBecauseOfNonText;
    }
    handleAbortTrigger(lastHistoryItemType) {
        if (this.shouldAbort && this.signal?.aborted && this.stopOnAbortSignal) {
            if (this.res.length === 0)
                throw this.signal.reason;
            this.segmentHandler.onFinishedGeneration();
            const trimWhitespaceSuffix = this.grammar?.trimWhitespaceSuffix || this.trimWhitespaceSuffix;
            const responseSegments = this.segmentHandler.getModelResponseSegments(trimWhitespaceSuffix);
            return {
                response: responseSegments
                    .filter((segment) => typeof segment === "string")
                    .join(""),
                fullResponse: responseSegments,
                lastEvaluation: {
                    contextWindow: mergeGeneratedResultWithChatHistory(lastHistoryItemType, this.lastContextWindowHistory, this.segmentHandler.getContextWindowModelResponseSegments(trimWhitespaceSuffix)),
                    cleanHistory: mergeGeneratedResultWithChatHistory(lastHistoryItemType, this.resolvedHistory, responseSegments),
                    contextShiftMetadata: this.lastHistoryCompressionMetadata
                },
                metadata: {
                    stopReason: this.shouldAbortBecauseOfNonText
                        ? "eogToken"
                        : "abort"
                }
            };
        }
        return undefined;
    }
    pushPendingTokensAndCallOnToken() {
        if (this.pendingTokens.length === 0)
            return;
        this.segmentHandler.processTokens(this.pendingTokens);
        pushAll(this.res, this.pendingTokens);
        this.pendingTokens.length = 0;
    }
    getLastTokens(maxTokens = maxRecentDetokenizerTokens) {
        return resolveLastTokens([
            this.contextWindowTokens,
            this.ignoredStartTextTokens,
            this.pendingTokens,
            this.streamRegulator.getLastQueuedChunkTokens(maxTokens),
            this.getContextWindowFunctionCallsTokens(),
            this.pendingPartialTokens
        ], maxTokens);
    }
}
class SegmentHandler {
    model;
    onToken;
    onTextChunk;
    onResponseChunk;
    _closeAllSegmentsDetector;
    _segmentDetectors;
    _segmentsStack = [];
    _segmentsStackSet = new Set();
    _ownedSegmentsStackLength = 0;
    _segments = [];
    _segmentsStartTokenTrail = [];
    _segmentTokenCounts;
    _contextWindowSegments = [];
    _contextWindowStartTokenTrail = [];
    _initialTokensTrail;
    _tokensTrail;
    _streamRegulator = new TokenStreamRegulator();
    _segmentDefinitions;
    constructor({ model, onTextChunk, onToken, onResponseChunk, segmentDefinitions, closeAllSegments, initialSegmentStack, initialTokenCounts, previousTokens }) {
        this.model = model;
        this.onTextChunk = onTextChunk;
        this.onToken = onToken;
        this.onResponseChunk = onResponseChunk;
        this._initialTokensTrail = previousTokens.slice(-maxRecentDetokenizerTokens);
        this._segmentsStartTokenTrail = previousTokens.slice(-maxRecentDetokenizerTokens);
        this._tokensTrail = previousTokens.slice(-maxRecentDetokenizerTokens);
        this._closeAllSegmentsDetector = closeAllSegments != null
            ? new StopGenerationDetector()
                .addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(closeAllSegments), this.model.tokenizer))
            : undefined;
        this._segmentDetectors = new Map();
        this._segmentsStack = initialSegmentStack;
        this._segmentsStackSet = new Set(initialSegmentStack);
        this._ownedSegmentsStackLength = initialSegmentStack.length;
        this._segmentDefinitions = segmentDefinitions;
        this._segmentTokenCounts = new Map(initialTokenCounts);
        for (const [segment, { prefix, suffix }] of segmentDefinitions.entries()) {
            this._segmentDetectors.set(segment, {
                prefix: new StopGenerationDetector()
                    .addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(prefix), this.model.tokenizer)),
                suffix: suffix != null
                    ? new StopGenerationDetector()
                        .addStopTrigger(StopGenerationDetector.resolveLlamaTextTrigger(LlamaText(suffix), this.model.tokenizer))
                    : undefined
            });
        }
    }
    processTokens(tokens) {
        if (tokens.length === 0)
            return;
        let pendingTokens = [];
        for (const token of tokens) {
            pendingTokens.push(token);
            const currentText = this.model.detokenize(pendingTokens, false, this._tokensTrail);
            if (currentText.endsWith(UNKNOWN_UNICODE_CHAR))
                continue;
            pushAll(this._tokensTrail, pendingTokens);
            this._processTokens(pendingTokens, currentText);
            pendingTokens = [];
        }
    }
    onFinishedGeneration() {
        this._clearDetectors();
        this._pushCurrentTokens(this._streamRegulator.popFreeChunkTokens());
    }
    resetContextWindow() {
        this._contextWindowSegments.length = 0;
        this._contextWindowStartTokenTrail.length = 0;
        pushAll(this._contextWindowStartTokenTrail, this._getTokenTrailFromResult());
    }
    openSegment(type) {
        const now = Date.now();
        this._segmentsStack.push(type);
        this._segmentsStackSet.add(type);
        this._segments.push({ type, tokens: [], ended: false, start: true, startTime: now });
        this._contextWindowSegments.push({ type, tokens: [], ended: false, start: true, startTime: now });
        this.onResponseChunk?.({
            type: "segment",
            segmentType: type,
            tokens: [],
            text: "",
            segmentStartTime: new Date(now)
        });
    }
    closeSegment(type) {
        if (!this.isSegmentTypeOpen(type))
            return;
        this._closeSegment(type);
    }
    getSegmentTokensCount(type) {
        return this._segmentTokenCounts.get(type) ?? 0;
    }
    isSegmentTypeOpen(type) {
        return this._segmentsStackSet.has(type);
    }
    get topOpenSegmentType() {
        return this._segmentsStack.at(-1);
    }
    /**
     * First segment in the stack is the top most that'll close last.
     * ```
     * <segment1>
     *     some text here
     *     <segment2>
     *        some text here
     *         <segment3>
     *             some text here
     *         </segment3>
     * ```
     * In that example, the top most segment is `segment1`, and the last open segment is `segment2` (which is the next one to close).
     * So in that example, this function will return:
     * ```
     * ["segment1", "segment2"]
     * ```
     */
    getOpenSegmentStack() {
        return this._segmentsStack.slice(this._ownedSegmentsStackLength);
    }
    _processTokens(tokens, text) {
        const queuedTokenRelease = this._streamRegulator.addChunk({
            tokens,
            text
        });
        const currentType = this._segmentsStack.at(-1);
        const handleDetector = (stopDetector, action, type) => {
            if (stopDetector == null)
                return false;
            stopDetector.recordGeneration({
                text,
                tokens,
                queuedTokenRelease
            });
            if (stopDetector.hasTriggeredStops) {
                const [leftTokens, leftText] = this._handleTriggeredStopDetector(stopDetector);
                if (action === "pop")
                    this._closeSegment(type);
                else if (action === "push") {
                    this.openSegment(type);
                }
                else if (action === "reset") {
                    const now = Date.now();
                    while (this._segmentsStack.length > 0) {
                        const segmentType = this._segmentsStack.pop();
                        this._segmentsStackSet.delete(segmentType);
                        const lastSegment = this._segments.at(-1);
                        if (lastSegment != null && !(lastSegment instanceof Array) && lastSegment.type === segmentType) {
                            lastSegment.ended = true;
                            lastSegment.endTime = now;
                            this.onResponseChunk?.({
                                type: "segment",
                                segmentType: segmentType,
                                tokens: [],
                                text: "",
                                segmentStartTime: undefined,
                                segmentEndTime: new Date(now)
                            });
                        }
                        else {
                            this._segments.push({ type: segmentType, tokens: [], ended: true, start: false, endTime: now });
                            this.onResponseChunk?.({
                                type: "segment",
                                segmentType: segmentType,
                                tokens: [],
                                text: "",
                                segmentStartTime: undefined,
                                segmentEndTime: new Date(now)
                            });
                        }
                        const lastContextWindowSegment = this._contextWindowSegments.at(-1);
                        if (lastContextWindowSegment != null && !(lastContextWindowSegment instanceof Array) &&
                            lastContextWindowSegment.type === segmentType)
                            lastContextWindowSegment.ended = true;
                        else
                            this._contextWindowSegments.push({ type: segmentType, tokens: [], ended: true, start: false, endTime: now });
                    }
                    this._ownedSegmentsStackLength = 0;
                }
                if (leftTokens.length > 0)
                    this._processTokens(leftTokens, leftText);
                return true;
            }
            return false;
        };
        if (currentType != null) {
            if (handleDetector(this._closeAllSegmentsDetector, "reset", currentType))
                return;
            if (handleDetector(this._segmentDetectors.get(currentType)?.suffix, "pop", currentType))
                return;
        }
        else
            this._closeAllSegmentsDetector?.clearInProgressStops();
        for (const [type, { prefix, suffix }] of this._segmentDetectors.entries()) {
            if (!this._segmentsStackSet.has(type)) {
                if (handleDetector(prefix, "push", type))
                    return;
            }
            else
                prefix.clearInProgressStops();
            if (this._segmentsStackSet.has(type)) {
                // `currentType` suffix is already handled above
                if (type !== currentType && handleDetector(suffix, "pop", type))
                    return;
            }
            else
                suffix?.clearInProgressStops();
        }
        this._pushCurrentTokens(this._streamRegulator.popFreeChunkTokens());
    }
    _handleTriggeredStopDetector(stopDetector) {
        this._clearDetectors(stopDetector);
        stopDetector.clearInProgressStops();
        const triggeredStops = stopDetector.getTriggeredStops();
        const freeTokens = this._streamRegulator.popFreeChunkTokens();
        const partiallyFreeTokens = this._streamRegulator.getPartiallyFreeChunk(this.model.tokenizer);
        const queuedTokensBeforeStopTrigger = getQueuedTokensBeforeStopTrigger(triggeredStops, partiallyFreeTokens, this.model.tokenizer);
        const { firstRemainingGenerationAfterStop } = StopGenerationDetector.getFirstRemainingGenerationAfterStop(triggeredStops);
        const remainingTokens = typeof firstRemainingGenerationAfterStop === "string"
            ? firstRemainingGenerationAfterStop === ""
                ? []
                : this.model.tokenize(firstRemainingGenerationAfterStop, false)
            : (firstRemainingGenerationAfterStop ?? []);
        const remainingText = typeof firstRemainingGenerationAfterStop === "string"
            ? firstRemainingGenerationAfterStop
            : this.model.detokenize(remainingTokens, false, queuedTokensBeforeStopTrigger.length === 0
                ? this._getTokenTrailFromResult()
                : queuedTokensBeforeStopTrigger);
        this._pushCurrentTokens([...freeTokens, ...queuedTokensBeforeStopTrigger]);
        stopDetector.clearTriggeredStops();
        this._streamRegulator.reset();
        return [remainingTokens, remainingText];
    }
    _closeSegment(type) {
        if (type == null)
            return;
        const lastSegment = this._segments.at(-1);
        const now = Date.now();
        if (lastSegment != null && !(lastSegment instanceof Array) && lastSegment.type === type && this._segmentsStack.at(-1) === type) {
            if (lastSegment.ended !== true) {
                lastSegment.ended = true;
                lastSegment.endTime = now;
                this.onResponseChunk?.({
                    type: "segment",
                    segmentType: type,
                    tokens: [],
                    text: "",
                    segmentStartTime: undefined,
                    segmentEndTime: new Date(now)
                });
            }
            const lastContextWindowSegment = this._contextWindowSegments.at(-1);
            if (lastContextWindowSegment != null && !(lastContextWindowSegment instanceof Array) &&
                lastContextWindowSegment.type === type && this._segmentsStack.at(-1) === type) {
                if (lastContextWindowSegment.ended !== true) {
                    lastContextWindowSegment.ended = true;
                    lastContextWindowSegment.endTime = now;
                }
            }
            else
                this._contextWindowSegments.push({ type, tokens: [], ended: true, start: false, endTime: now });
            this._segmentsStackSet.delete(this._segmentsStack.pop());
            if (this._segmentsStack.length < this._ownedSegmentsStackLength)
                this._ownedSegmentsStackLength = this._segmentsStack.length;
            return;
        }
        const typeIndex = this._segmentsStack.lastIndexOf(type);
        if (typeIndex < 0)
            return;
        for (let i = this._segmentsStack.length - 1; i >= typeIndex; i--) {
            const segmentType = this._segmentsStack.pop();
            this._segmentsStackSet.delete(segmentType);
            if (this._segmentsStack.length < this._ownedSegmentsStackLength)
                this._ownedSegmentsStackLength = this._segmentsStack.length;
            this._segments.push({ type: segmentType, tokens: [], ended: true, start: false, endTime: now });
            this._contextWindowSegments.push({ type: segmentType, tokens: [], ended: true, start: false, endTime: now });
            this.onResponseChunk?.({
                type: "segment",
                segmentType: segmentType,
                tokens: [],
                text: "",
                segmentStartTime: undefined,
                segmentEndTime: new Date(now)
            });
        }
    }
    _clearDetectors(skipDetector) {
        if (this._closeAllSegmentsDetector !== skipDetector) {
            this._closeAllSegmentsDetector?.clearInProgressStops();
            this._closeAllSegmentsDetector?.clearTriggeredStops();
        }
        for (const { prefix, suffix } of this._segmentDetectors.values()) {
            if (prefix !== skipDetector) {
                prefix.clearInProgressStops();
                prefix.clearTriggeredStops();
            }
            if (suffix !== skipDetector) {
                suffix?.clearInProgressStops();
                suffix?.clearTriggeredStops();
            }
        }
    }
    _pushCurrentTokens(tokens) {
        const lastSegment = this._segments.at(-1);
        const lastContextWindowSegment = this._contextWindowSegments.at(-1);
        const type = this._segmentsStack.at(-1);
        this._segmentTokenCounts.set(type, (this._segmentTokenCounts.get(type) ?? 0) + tokens.length);
        if (type == null) {
            if (lastSegment == null) {
                const text = (this.onResponseChunk != null || this.onTextChunk != null)
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";
                this._segments.push(tokens);
                this.onToken?.(tokens.slice());
                this.onTextChunk?.(text);
                this.onResponseChunk?.({ type: undefined, segmentType: undefined, tokens: tokens.slice(), text });
            }
            else {
                const text = (this.onResponseChunk != null || this.onTextChunk != null)
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";
                if (lastSegment instanceof Array)
                    pushAll(lastSegment, tokens);
                else
                    this._segments.push(tokens);
                this.onToken?.(tokens.slice());
                this.onTextChunk?.(text);
                this.onResponseChunk?.({ type: undefined, segmentType: undefined, tokens: tokens.slice(), text });
            }
            if (lastContextWindowSegment == null)
                this._contextWindowSegments.push(tokens.slice());
            else {
                if (lastContextWindowSegment instanceof Array)
                    pushAll(lastContextWindowSegment, tokens);
                else
                    this._contextWindowSegments.push(tokens.slice());
            }
        }
        else {
            const now = Date.now();
            if (lastSegment == null) {
                const text = this.onResponseChunk != null
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";
                this._segments.push({
                    type,
                    tokens,
                    ended: false,
                    start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                    startTime: now
                });
                this.onResponseChunk?.({
                    type: "segment",
                    segmentType: type,
                    tokens: tokens.slice(),
                    text,
                    segmentStartTime: new Date(now)
                });
            }
            else {
                const text = this.onResponseChunk != null
                    ? this.model.detokenize(tokens, false, this._getTokenTrailFromResult())
                    : "";
                if (lastSegment instanceof Array || lastSegment.type !== type) {
                    this._segments.push({
                        type,
                        tokens,
                        ended: false,
                        start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                        startTime: now
                    });
                    this.onResponseChunk?.({
                        type: "segment",
                        segmentType: type,
                        tokens: tokens.slice(),
                        text,
                        segmentStartTime: new Date(now)
                    });
                }
                else {
                    pushAll(lastSegment.tokens, tokens);
                    this.onResponseChunk?.({
                        type: "segment",
                        segmentType: type,
                        tokens: tokens.slice(),
                        text,
                        segmentStartTime: undefined
                    });
                }
            }
            if (lastContextWindowSegment == null)
                this._contextWindowSegments.push({
                    type,
                    tokens: tokens.slice(),
                    ended: false,
                    start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                    startTime: now
                });
            else {
                if (lastContextWindowSegment instanceof Array || lastContextWindowSegment.type !== type)
                    this._contextWindowSegments.push({
                        type,
                        tokens: tokens.slice(),
                        ended: false,
                        start: this._segmentsStack.length > this._ownedSegmentsStackLength,
                        startTime: now
                    });
                else
                    pushAll(lastContextWindowSegment.tokens, tokens);
            }
        }
    }
    _getTokenTrailFromResult() {
        const res = [];
        for (let i = this._segments.length - 1; i >= 0; i--) {
            const segment = this._segments[i];
            const segmentTokens = segment instanceof Array
                ? segment
                : segment.tokens;
            for (let j = segmentTokens.length - 1; j >= 0; j--) {
                res.unshift(segmentTokens[j]);
                if (res.length >= maxRecentDetokenizerTokens)
                    return res;
            }
        }
        for (let i = this._initialTokensTrail.length - 1; i >= 0; i--) {
            res.unshift(this._initialTokensTrail[i]);
            if (res.length >= maxRecentDetokenizerTokens)
                return res;
        }
        return res;
    }
    getModelResponseSegments(trimWhitespaceSuffix = false) {
        return this._getModelResponseForSegments(this._segments, this._segmentsStartTokenTrail, trimWhitespaceSuffix);
    }
    getContextWindowModelResponseSegments(trimWhitespaceSuffix = false) {
        return this._getModelResponseForSegments(this._contextWindowSegments, this._contextWindowStartTokenTrail, trimWhitespaceSuffix);
    }
    _getModelResponseForSegments(rawSegments, recentTokens, trimWhitespaceSuffix) {
        let tokenTrail = resolveLastTokens([recentTokens]);
        return rawSegments.map((rawSegment, index) => {
            const isLast = index === rawSegments.length - 1;
            if (rawSegment instanceof Array) {
                let text = this.model.detokenize(rawSegment, false, tokenTrail);
                if (isLast && trimWhitespaceSuffix)
                    text = text.trimEnd();
                tokenTrail = resolveLastTokens([tokenTrail, rawSegment]);
                return text;
            }
            let text = this.model.detokenize(rawSegment.tokens, false, tokenTrail);
            if (isLast && rawSegment.ended && trimWhitespaceSuffix)
                text = text.trimEnd();
            tokenTrail = resolveLastTokens([tokenTrail, rawSegment.tokens]);
            const segmentDefinition = this._segmentDefinitions.get(rawSegment.type);
            return {
                type: "segment",
                segmentType: rawSegment.type,
                text,
                ended: rawSegment.ended,
                raw: segmentDefinition == null
                    ? LlamaText([text]).toJSON()
                    : LlamaText([
                        rawSegment.start
                            ? segmentDefinition.prefix
                            : "",
                        text,
                        rawSegment.ended
                            ? (segmentDefinition.suffix ?? "")
                            : ""
                    ]).toJSON(),
                startTime: rawSegment.startTime != null
                    ? new Date(rawSegment.startTime).toISOString()
                    : undefined,
                endTime: rawSegment.endTime != null
                    ? new Date(rawSegment.endTime).toISOString()
                    : undefined
            };
        });
    }
    static getStackFromModelResponse(modelResponse) {
        const stack = [];
        const stackSet = new Set();
        for (const item of modelResponse) {
            if (typeof item === "string" || isChatModelResponseFunctionCall(item))
                continue;
            void item.type;
            if (item.ended && stack.at(-1) === item.segmentType) {
                stack.pop();
                stackSet.delete(item.segmentType);
            }
            else if (!item.ended && !stackSet.has(item.segmentType)) {
                stack.push(item.segmentType);
                stackSet.add(item.segmentType);
            }
        }
        return stack;
    }
    static getSegmentTokenCounts(modelResponse, tokenizer) {
        const segmentTokenCounts = new Map();
        for (const item of modelResponse) {
            if (typeof item === "string") {
                segmentTokenCounts.set(undefined, (segmentTokenCounts.get(undefined) ?? 0) + tokenizer(item, false, "trimLeadingSpace").length);
                continue;
            }
            else if (isChatModelResponseFunctionCall(item))
                continue;
            void item.type;
            segmentTokenCounts.set(item.segmentType, (segmentTokenCounts.get(item.segmentType) ?? 0) + tokenizer(item.text, false, "trimLeadingSpace").length);
        }
        return segmentTokenCounts;
    }
}
//# sourceMappingURL=LlamaChat.js.map