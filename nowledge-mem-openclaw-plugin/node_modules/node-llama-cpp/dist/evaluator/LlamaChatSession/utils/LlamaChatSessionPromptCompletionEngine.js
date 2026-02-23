import { DisposeAggregator, DisposedError } from "lifecycle-utils";
import { getConsoleLogPrefix } from "../../../utils/getConsoleLogPrefix.js";
import { LruCache } from "../../../utils/LruCache.js";
import { safeEventCallback } from "../../../utils/safeEventCallback.js";
export const defaultMaxPreloadTokens = (sequence) => {
    const defaultValue = 256;
    return sequence.model.fileInsights.swaSize != null
        ? Math.min(Math.ceil(sequence.model.fileInsights.swaSize / 2), defaultValue, Math.ceil(sequence.contextSize / 2))
        : Math.min(defaultValue, Math.ceil(sequence.contextSize / 2));
};
const defaultMaxCachedCompletions = 100;
export class LlamaChatSessionPromptCompletionEngine {
    /** @internal */ _chatSession;
    /** @internal */ _maxPreloadTokens;
    /** @internal */ _maxCachedCompletions;
    /** @internal */ _onGeneration;
    /** @internal */ _completionOptions;
    /** @internal */ _completionCaches = new WeakMap();
    /** @internal */ _disposeAggregator = new DisposeAggregator();
    /** @internal */ _currentCompletionAbortController = new AbortController();
    /** @internal */ _lastPrompt;
    /** @internal */ _disposed = false;
    constructor(chatSession, { maxPreloadTokens = defaultMaxPreloadTokens(chatSession.sequence), onGeneration, maxCachedCompletions = defaultMaxCachedCompletions, ...options }) {
        this._chatSession = chatSession;
        this._maxPreloadTokens = Math.max(1, maxPreloadTokens);
        this._maxCachedCompletions = Math.max(1, maxCachedCompletions);
        this._onGeneration = safeEventCallback(onGeneration);
        this._completionOptions = options;
        this.dispose = this.dispose.bind(this);
        this._disposeAggregator.add(this._chatSession.onDispose.createListener(this.dispose));
        this._disposeAggregator.add(() => {
            this._disposed = true;
            this._currentCompletionAbortController.abort();
        });
    }
    dispose() {
        if (this._disposed)
            return;
        this._disposeAggregator.dispose();
    }
    /**
     * Get completion for the prompt from the cache,
     * and begin preloading this prompt into the context sequence and completing it.
     *
     * On completion progress, `onGeneration` (configured for this engine instance) will be called.
     */
    complete(prompt) {
        if (this._disposed)
            throw new DisposedError();
        const completionCache = this._getCurrentCompletionCache();
        const completion = completionCache.getCompletion(prompt);
        if (this._lastPrompt == null || !(this._lastPrompt + (completion ?? "")).startsWith(prompt)) {
            this._lastPrompt = prompt;
            this._restartCompletion(completionCache);
        }
        this._lastPrompt = prompt;
        return completion ?? "";
    }
    /** @internal */
    _getCurrentCompletionCache() {
        const completionCache = this._completionCaches.get(this._chatSession._chatHistoryStateRef);
        if (completionCache != null)
            return completionCache;
        const newCompletionCache = new CompletionCache(this._maxCachedCompletions);
        this._completionCaches.set(this._chatSession._chatHistoryStateRef, newCompletionCache);
        return newCompletionCache;
    }
    /** @internal */
    _restartCompletion(completionCache) {
        if (this._disposed)
            return;
        this._currentCompletionAbortController.abort();
        this._currentCompletionAbortController = new AbortController();
        const prompt = this._lastPrompt;
        if (prompt == null)
            return;
        const existingCompletion = completionCache.getCompletion(prompt);
        const promptToComplete = prompt + (existingCompletion ?? "");
        const currentPromptTokens = this._chatSession.model.tokenize(promptToComplete, false, "trimLeadingSpace").length;
        const leftTokens = Math.max(0, this._maxPreloadTokens - currentPromptTokens);
        if (leftTokens === 0)
            return;
        const currentAbortController = this._currentCompletionAbortController;
        const currentAbortSignal = this._currentCompletionAbortController.signal;
        let currentCompletion = "";
        void this._chatSession.completePrompt(promptToComplete, {
            ...this._completionOptions,
            stopOnAbortSignal: false,
            maxTokens: leftTokens,
            signal: currentAbortSignal,
            onTextChunk: (chunk) => {
                currentCompletion += chunk;
                const completion = (existingCompletion ?? "") + currentCompletion;
                completionCache.putCompletion(prompt, completion);
                if (this._getCurrentCompletionCache() !== completionCache) {
                    currentAbortController.abort();
                    return;
                }
                if (this._lastPrompt === prompt)
                    this._onGeneration?.(prompt, completion);
            }
        })
            .then(() => {
            if (this._lastPrompt !== prompt && this._getCurrentCompletionCache() === completionCache)
                return this._restartCompletion(completionCache);
        })
            .catch((err) => {
            if ((currentAbortSignal.aborted && err === currentAbortSignal.reason) || err instanceof DOMException)
                return;
            console.error(getConsoleLogPrefix(false, false), err);
        });
    }
    /** @internal */
    static _create(chatSession, options = {}) {
        return new LlamaChatSessionPromptCompletionEngine(chatSession, options);
    }
}
class CompletionCache {
    /** @internal */ _cache;
    /** @internal */ _rootNode = [new Map()];
    constructor(maxInputs) {
        this._cache = new LruCache(maxInputs, {
            onDelete: (key) => {
                this._deleteInput(key);
            }
        });
    }
    get maxInputs() {
        return this._cache.maxSize;
    }
    getCompletion(input) {
        let node = this._rootNode;
        for (let i = 0; i < input.length; i++) {
            if (node == null)
                return null;
            const [next, completion] = node;
            const char = input[i];
            if (!next.has(char)) {
                if (completion != null && completion.startsWith(input.slice(i))) {
                    this._cache.get(input.slice(0, i));
                    return completion.slice(input.length - i);
                }
            }
            node = next.get(char);
        }
        if (node == null)
            return null;
        const [, possibleCompletion] = node;
        if (possibleCompletion != null) {
            this._cache.get(input);
            return possibleCompletion;
        }
        return null;
    }
    putCompletion(input, completion) {
        this._cache.set(input, null);
        let node = this._rootNode;
        for (let i = 0; i < input.length; i++) {
            const [next] = node;
            const char = input[i];
            if (!next.has(char))
                next.set(char, [new Map()]);
            node = next.get(char);
        }
        const currentCompletion = node[1];
        if (currentCompletion != null && currentCompletion.startsWith(completion))
            return currentCompletion;
        node[1] = completion;
        return completion;
    }
    /** @internal */
    _deleteInput(input) {
        let lastNodeWithMultipleChildren = this._rootNode;
        let lastNodeWithMultipleChildrenDeleteChar = input[0];
        let node = this._rootNode;
        for (let i = 0; i < input.length; i++) {
            const [next] = node;
            const char = input[i];
            if (next.size > 1) {
                lastNodeWithMultipleChildren = node;
                lastNodeWithMultipleChildrenDeleteChar = char;
            }
            if (!next.has(char))
                return;
            node = next.get(char);
        }
        if (lastNodeWithMultipleChildrenDeleteChar !== "")
            lastNodeWithMultipleChildren[0].delete(lastNodeWithMultipleChildrenDeleteChar);
    }
}
//# sourceMappingURL=LlamaChatSessionPromptCompletionEngine.js.map