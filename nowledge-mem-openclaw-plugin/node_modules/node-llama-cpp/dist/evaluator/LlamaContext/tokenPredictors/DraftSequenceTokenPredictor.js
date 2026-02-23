import { withLock } from "lifecycle-utils";
import { pushAll } from "../../../utils/pushAll.js";
import { getConsoleLogPrefix } from "../../../utils/getConsoleLogPrefix.js";
import { LlamaSampler } from "../LlamaSampler.js";
import { TokenPredictor } from "../TokenPredictor.js";
const defaultPredictionMinTokens = 0;
const defaultPredictionMaxTokens = 16;
const defaultPredictionMinConfidence = 0.6;
/**
 * Predicts the next tokens by evaluating the current state of the target sequence
 * on a draft sequence from a smaller and faster draft model.
 * @see [Using Token Predictors: Draft Model Token Predictor](https://node-llama-cpp.withcat.ai/guide/token-prediction#draft-model)
 */
export class DraftSequenceTokenPredictor extends TokenPredictor {
    /** @internal */ _draftSequence;
    /** @internal */ _minTokens;
    /** @internal */ _maxTokens;
    /** @internal */ _minConfidence;
    /** @internal */ _stateTokens = [];
    /** @internal */ _pendingEvalTokens = [];
    /** @internal */ _predictedTokens = [];
    /** @internal */ _evaluateOptions = {};
    /** @internal */ _overrideEvaluateOptions = {};
    /** @internal */ _grammarEvaluationStateOption;
    /** @internal */ _currentEvaluationAbortController = new AbortController();
    /** @internal */ _resetAbortController = new AbortController();
    /** @internal */ _stopped = true;
    /** @internal */ _waitForPredictionExhaustion = false;
    /** @internal */ _minTokensCallbacks = [];
    /** @internal */ _resetPredictions = false;
    /** @internal */ _iterator;
    /** @internal */ _active = false;
    /** @internal */ _disposed = false;
    constructor(draftSequence, options = {}) {
        super();
        this._draftSequence = draftSequence;
        this._minTokens = Math.floor(Math.max(0, options?.minTokens ?? defaultPredictionMinTokens));
        this._maxTokens = Math.floor(Math.max(this._minTokens, options?.maxTokens ?? defaultPredictionMaxTokens));
        this._overrideEvaluateOptions = options.evaluateOptions ?? {};
        this._minConfidence = Math.min(1, Math.max(0, options?.minConfidence ?? defaultPredictionMinConfidence));
        if (draftSequence.disposed)
            throw new Error("The draft sequence is disposed");
    }
    get draftSequence() {
        return this._draftSequence;
    }
    get minTokens() {
        return this._minTokens;
    }
    get maxTokens() {
        return this._maxTokens;
    }
    get minConfidence() {
        return this._minConfidence;
    }
    async reset({ targetSequence, stateTokens, evaluateOptions }) {
        this._currentEvaluationAbortController.abort();
        this._resetAbortController.abort();
        this._currentEvaluationAbortController = new AbortController();
        this._resetAbortController = new AbortController();
        this._stopped = true;
        this._waitForPredictionExhaustion = false;
        this._iterator?.return();
        this._iterator = undefined;
        const currentAbortSignal = this._resetAbortController.signal;
        targetSequence.context._ctx.ensureDraftContextIsCompatibleForSpeculative(this._draftSequence.context._ctx);
        try {
            await withLock([this, "evaluate"], currentAbortSignal, async () => {
                this._stateTokens = stateTokens.slice();
                this._pendingEvalTokens = [];
                this._predictedTokens = [];
                this._resetPredictions = false;
                while (this._minTokensCallbacks.length > 0)
                    this._minTokensCallbacks.shift()?.();
                const lastToken = this._stateTokens.pop();
                if (lastToken != null)
                    this._pendingEvalTokens.push(lastToken);
                this._evaluateOptions = evaluateOptions;
                this._grammarEvaluationStateOption = this._evaluateOptions.grammarEvaluationState instanceof Function
                    ? this._evaluateOptions.grammarEvaluationState()?.clone()
                    : this._evaluateOptions.grammarEvaluationState?.clone();
                const newStateTokens = this._stateTokens.slice(-this._draftSequence.context.contextSize + 1);
                await this._draftSequence.adaptStateToTokens(newStateTokens, true);
                newStateTokens.splice(0, this._draftSequence.nextTokenIndex);
                await this._draftSequence.evaluateWithoutGeneratingNewTokens(newStateTokens, {
                    contextShift: this._evaluateOptions.contextShift,
                    evaluationPriority: this._evaluateOptions.evaluationPriority
                });
            });
        }
        catch (err) {
            if (err !== currentAbortSignal.reason)
                throw err;
        }
    }
    pushTokens(tokens) {
        const grammarEvaluationStateOption = this._evaluateOptions.grammarEvaluationState instanceof Function
            ? this._evaluateOptions.grammarEvaluationState()?.clone()
            : this._evaluateOptions.grammarEvaluationState?.clone();
        void withLock([this, "pushTokens"], async () => {
            this._grammarEvaluationStateOption = grammarEvaluationStateOption;
            const tokensToPush = tokens.slice();
            while (!this._resetPredictions && tokensToPush.length > 0) {
                const token = tokensToPush.shift();
                if (this._predictedTokens.length > 0 && this._predictedTokens[0] === token) {
                    this._predictedTokens.shift();
                }
                else {
                    tokensToPush.unshift(token);
                    break;
                }
            }
            if (tokensToPush.length === 0) {
                if (!this._waitForPredictionExhaustion || this._predictedTokens.length === 0)
                    this._resume();
                return;
            }
            this._currentEvaluationAbortController.abort();
            this._currentEvaluationAbortController = new AbortController();
            pushAll(this._pendingEvalTokens, tokensToPush);
            this._resetPredictions = true;
            this._resume();
        });
    }
    predictTokens() {
        if (this._stopped && this._pendingEvalTokens.length === 0 && !this._resetPredictions)
            return this._predictedTokens;
        this._stopped = false;
        if (!this._waitForPredictionExhaustion || this._predictedTokens.length === 0) {
            this._waitForPredictionExhaustion = false;
            this._resume();
        }
        if (this._predictedTokens.length >= this._minTokens && !this._resetPredictions)
            return this._predictedTokens;
        if (!this._active || (this._waitForPredictionExhaustion && this._predictedTokens.length > 0)) {
            if (this._resetPredictions)
                return [];
            return this._predictedTokens;
        }
        return new Promise((accept) => void this._minTokensCallbacks.push(accept))
            .then(() => {
            if (this._resetPredictions)
                return [];
            return this._predictedTokens;
        });
    }
    stop(untilPredictionsExhausted = false) {
        this._stopped = true;
        this._currentEvaluationAbortController.abort();
        this._currentEvaluationAbortController = new AbortController();
        if (untilPredictionsExhausted)
            this._waitForPredictionExhaustion = true;
        void withLock([this, "evaluate"], async () => {
            this._iterator?.return();
            this._iterator = undefined;
        });
    }
    dispose() {
        this._disposed = true;
        this._stopped = true;
        this._resetAbortController.abort();
        this._currentEvaluationAbortController.abort();
        void withLock([this, "evaluate"], async () => {
            this._iterator?.return();
            this._iterator = undefined;
        });
    }
    /** @internal */
    _canIterate() {
        return !this._disposed && !this._stopped && (this._predictedTokens.length < this._maxTokens || this._resetPredictions);
    }
    /** @internal */
    _resume() {
        if (this._active || !this._canIterate())
            return;
        this._active = true;
        void withLock([this, "evaluate"], async () => {
            try {
                const abortSignal = this._currentEvaluationAbortController.signal;
                if (!this._canIterate() || abortSignal.aborted)
                    return;
                const resetPredications = async () => {
                    this._iterator?.return();
                    this._iterator = undefined;
                    this._waitForPredictionExhaustion = false;
                    this._resetPredictions = false;
                    const tokenToDelete = Math.max(0, Math.min(this._predictedTokens.length - 1, this._draftSequence.context.contextSize));
                    this._predictedTokens = [];
                    await this._draftSequence.eraseContextTokenRanges([{
                            start: this._draftSequence.nextTokenIndex - tokenToDelete,
                            end: this._draftSequence.nextTokenIndex
                        }]);
                };
                const createIterator = () => {
                    const tokens = this._pendingEvalTokens;
                    this._pendingEvalTokens = [];
                    return this.draftSequence.evaluateWithMetadata(tokens, { confidence: true }, {
                        ...this._evaluateOptions,
                        ...this._overrideEvaluateOptions,
                        grammarEvaluationState: this._getGrammarEvaluationStateWithTokens(tokens)
                    });
                };
                if (this._resetPredictions)
                    await resetPredications();
                if (!this._canIterate() || abortSignal.aborted)
                    return;
                let iterator = createIterator();
                this._iterator = iterator;
                while (this._canIterate() && !abortSignal.aborted) {
                    const { value, done } = await iterator.next();
                    let shouldBreak = done;
                    if (value != null) {
                        const { token, confidence } = value;
                        if (this._minConfidence != null && this._minConfidence !== 0 && this._minConfidence !== 1 &&
                            confidence < this._minConfidence) {
                            this._iterator = undefined;
                            await iterator.return();
                            this._waitForPredictionExhaustion = true;
                            shouldBreak = true;
                        }
                        else
                            this._predictedTokens.push(token);
                    }
                    if (this._resetPredictions && !abortSignal.aborted) {
                        await resetPredications();
                        iterator = createIterator();
                        this._iterator = iterator;
                        continue;
                    }
                    if (this._predictedTokens.length >= this._minTokens) {
                        while (this._minTokensCallbacks.length > 0)
                            this._minTokensCallbacks.shift()?.();
                    }
                    if (shouldBreak) {
                        this._iterator = undefined;
                        await iterator.return();
                        this._waitForPredictionExhaustion = true;
                        while (this._minTokensCallbacks.length > 0)
                            this._minTokensCallbacks.shift()?.();
                        break;
                    }
                }
            }
            finally {
                this._active = false;
            }
        });
    }
    /** @internal */
    _getGrammarEvaluationStateWithTokens(tokens) {
        if (this._grammarEvaluationStateOption == null)
            return undefined;
        const clone = this._grammarEvaluationStateOption.clone();
        for (const token of tokens) {
            const canAddToken = LlamaSampler._canBeNextTokenForGrammarEvaluationState(this._draftSequence.model._llama, clone, token);
            if (!canAddToken) {
                console.warn(getConsoleLogPrefix(false, false), "The pushed tokens are incompatible with the grammar evaluation state. The grammar will be ignored.");
                this._grammarEvaluationStateOption = undefined;
                return undefined;
            }
            LlamaSampler._acceptTokenOnGrammarEvaluationState(this._draftSequence.model._llama, clone, token);
        }
        return clone;
    }
}
//# sourceMappingURL=DraftSequenceTokenPredictor.js.map