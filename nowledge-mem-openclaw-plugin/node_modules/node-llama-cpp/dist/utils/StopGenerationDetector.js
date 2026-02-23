import { SpecialToken, isLlamaText, SpecialTokensText } from "./LlamaText.js";
export class StopGenerationDetector {
    /** @internal */ _stopTriggers = new Map();
    /** @internal */ _activeChecks = new Set();
    /** @internal */ _triggeredStops = new Map();
    recordGeneration({ text, tokens, queuedTokenRelease, startNewChecks = true, triggerMustStartWithGeneration = false }) {
        const currentActiveChecks = this._activeChecks;
        this._activeChecks = new Set();
        for (const check of currentActiveChecks) {
            let checkKept = false;
            if (text.length > 0)
                this._checkTriggerPart(check, text);
            else {
                this._activeChecks.add(check);
                checkKept = true;
            }
            if (tokens.length > 0)
                this._checkTriggerPart(check, tokens);
            else {
                this._activeChecks.add(check);
                checkKept = true;
            }
            if (!checkKept)
                check.queuedTokenReleaseLock?.dispose();
        }
        if (!startNewChecks)
            return;
        for (let i = 0; i < text.length && (!triggerMustStartWithGeneration || i === 0); i++) {
            const char = text[i];
            const currentPart = this._stopTriggers.get(char);
            if (currentPart == null)
                continue;
            const textCheck = {
                queuedTokenReleaseLock: queuedTokenRelease?.createTextIndexLock(i),
                currentPart
            };
            this._checkTriggerPart(textCheck, text.slice(i + 1));
            textCheck.queuedTokenReleaseLock?.dispose();
        }
        for (let i = 0; i < tokens.length && (!triggerMustStartWithGeneration || i === 0); i++) {
            const token = tokens[i];
            const currentPart = this._stopTriggers.get(token);
            if (currentPart == null)
                continue;
            const tokenCheck = {
                queuedTokenReleaseLock: queuedTokenRelease?.createTokenIndexLock(i),
                currentPart
            };
            this._checkTriggerPart(tokenCheck, tokens.slice(i + 1));
            tokenCheck.queuedTokenReleaseLock?.dispose();
        }
    }
    addStopTrigger(stopTrigger, completeEvent) {
        const simplifiedTrigger = simplifyStopTrigger(stopTrigger);
        const triggerValues = simplifiedTrigger
            .map((item) => {
            if (typeof item === "string")
                return item.split("");
            else
                return [item];
        })
            .flat(1);
        let currentMap = this._stopTriggers;
        for (let i = 0; i < triggerValues.length; i++) {
            const value = triggerValues[i];
            const isLast = i === triggerValues.length - 1;
            if (!currentMap.has(value)) {
                currentMap.set(value, {
                    next: new Map()
                });
            }
            const part = currentMap.get(value);
            if (isLast) {
                part.next = undefined;
                part.completesTrigger = simplifiedTrigger;
                part.completeEvents = part.completeEvents ?? new Set();
                if (completeEvent != null)
                    part.completeEvents.add(completeEvent);
            }
            else if (part.next == null)
                break;
            else
                currentMap = part.next;
        }
        return this;
    }
    /** Whether there are some stops that have been found and triggered. */
    get hasTriggeredStops() {
        return this._triggeredStops.size > 0;
    }
    /** Whether there are some stops that have been found, but not triggered yet. */
    get hasInProgressStops() {
        return this._activeChecks.size > 0;
    }
    /** Gets the stops that have been found and triggered. */
    getTriggeredStops() {
        const res = [];
        for (const [triggerPart, triggeredStop] of this._triggeredStops.entries()) {
            res.push({
                stopTrigger: triggerPart.completesTrigger,
                events: Array.from(triggerPart.completeEvents ?? new Set()),
                remainingGeneration: Array.from(triggeredStop.remainingGenerations),
                queuedTokenReleaseLocks: Array.from(triggeredStop.queuedTokenReleaseLocks)
            });
        }
        return res;
    }
    clearTriggeredStops() {
        for (const triggeredStop of this._triggeredStops.values()) {
            for (const queuedTokenReleaseLock of triggeredStop.queuedTokenReleaseLocks)
                queuedTokenReleaseLock.dispose();
        }
        this._triggeredStops.clear();
    }
    clearInProgressStops() {
        for (const check of this._activeChecks)
            check.queuedTokenReleaseLock?.dispose();
        this._activeChecks.clear();
    }
    get hasTriggers() {
        return this._stopTriggers.size > 0;
    }
    /**
     * For a given generation, get the number of possibilities that would be disregarded if the generation is recorded.
     *
     * Calling this function does not change the state of the detector.
     */
    getDisregardedPossibilitiesCountForAGeneration({ text, tokens, startNewChecks }) {
        let res = 0;
        for (const check of this._activeChecks) {
            const disregardedTextPossibilities = this._getCountOfPossibleTriggersToBeDisregarded(check.currentPart, text);
            const disregardedTokenPossibilities = this._getCountOfPossibleTriggersToBeDisregarded(check.currentPart, tokens);
            res += Math.min(disregardedTextPossibilities, disregardedTokenPossibilities);
        }
        if (startNewChecks) {
            const disregardedTextPossibilities = text.length > 0
                ? this._getCountOfPossibleTriggersToBeDisregarded(this._stopTriggers.get(text[0]), text.slice(1))
                : null;
            const disregardedTokenPossibilities = tokens.length > 0
                ? this._getCountOfPossibleTriggersToBeDisregarded(this._stopTriggers.get(tokens[0]), tokens.slice(1))
                : null;
            if (disregardedTextPossibilities != null && disregardedTokenPossibilities != null)
                res += Math.min(disregardedTextPossibilities, disregardedTokenPossibilities);
            else if (disregardedTextPossibilities != null)
                res += disregardedTextPossibilities;
            else if (disregardedTokenPossibilities != null)
                res += disregardedTokenPossibilities;
        }
        return res;
    }
    /** @internal */
    _addFoundStop(part, remainingGeneration, queuedTokenReleaseLock) {
        if (!this._triggeredStops.has(part))
            this._triggeredStops.set(part, {
                remainingGenerations: new Set(),
                queuedTokenReleaseLocks: new Set()
            });
        const triggeredStop = this._triggeredStops.get(part);
        if (remainingGeneration != null)
            triggeredStop.remainingGenerations.add(remainingGeneration);
        if (queuedTokenReleaseLock != null)
            triggeredStop.queuedTokenReleaseLocks.add(queuedTokenReleaseLock);
    }
    /** @internal */
    _getCountOfPossibleTriggersToBeDisregarded(initialPart, value) {
        if (initialPart == null)
            return 0;
        let part = initialPart;
        let res = 0;
        for (let i = 0; i < value.length && part != null; i++) {
            const item = value[i];
            if (part.next == null)
                return res + 1;
            if (part.next.has(item)) {
                res += part.next.size - 1;
                part = part.next.get(item);
                continue;
            }
            return res + part.next.size;
        }
        if (part == null || part.next == null)
            return res + 1;
        return res;
    }
    /** @internal */
    _checkTriggerPart(check, value) {
        if (check == null)
            return false;
        let part = check.currentPart;
        for (let i = 0; i < value.length && part != null; i++) {
            const item = value[i];
            if (part.next == null) {
                this._addFoundStop(part, value.slice(i), check.queuedTokenReleaseLock?.duplicate?.());
                return true;
            }
            if (part.next.has(item)) {
                part = part.next.get(item);
                continue;
            }
            return false;
        }
        if (part == null)
            return false;
        if (part.next == null) {
            this._addFoundStop(part, undefined, check.queuedTokenReleaseLock?.duplicate?.());
            return true;
        }
        else {
            this._activeChecks.add({
                ...check,
                currentPart: part,
                queuedTokenReleaseLock: check.queuedTokenReleaseLock?.duplicate?.()
            });
            return true;
        }
    }
    static resolveStopTriggers(stopTriggers, tokenizer) {
        return stopTriggers
            .map((stopTrigger) => {
            if (isLlamaText(stopTrigger))
                return StopGenerationDetector.resolveLlamaTextTrigger(stopTrigger, tokenizer);
            else if (typeof stopTrigger === "string")
                return simplifyStopTrigger([stopTrigger]);
            else
                return simplifyStopTrigger(stopTrigger);
        })
            .filter((stopTrigger) => stopTrigger.length > 0);
    }
    static resolveLlamaTextTrigger(llamaText, tokenizer) {
        return simplifyStopTrigger(llamaText.values
            .filter((value) => value !== "")
            .map((value) => {
            if (typeof value === "string")
                return [value];
            else if (value instanceof SpecialToken)
                return value.tokenize(tokenizer);
            else if (value instanceof SpecialTokensText)
                return value.tokenizeSpecialTokensOnly(tokenizer);
            return value;
        })
            .flat(1));
    }
    static getFirstRemainingGenerationAfterStop(triggeredStops) {
        const [stopTrigger] = triggeredStops
            .filter((stopTrigger) => (stopTrigger.remainingGeneration.some((remainingGeneration) => remainingGeneration.length > 0)));
        return {
            stopTrigger: stopTrigger?.stopTrigger ?? triggeredStops?.[0]?.stopTrigger,
            firstRemainingGenerationAfterStop: stopTrigger?.remainingGeneration?.filter((remainingGeneration) => remainingGeneration.length > 0)?.[0]
        };
    }
    static detokenizeRemainingGeneration(remainingGeneration, stopTrigger, tokenizer, specialTokens = false) {
        if (remainingGeneration == null || remainingGeneration.length === 0)
            return "";
        if (typeof remainingGeneration === "string")
            return remainingGeneration;
        return tokenizer.detokenize(remainingGeneration, specialTokens, tokenizeStopTrigger(stopTrigger, tokenizer, specialTokens));
    }
}
function simplifyStopTrigger(stopTrigger) {
    let text = "";
    const res = [];
    for (const item of stopTrigger) {
        if (typeof item === "string") {
            text += item;
            continue;
        }
        if (text !== "") {
            res.push(text);
            text = "";
        }
        res.push(item);
    }
    if (text !== "")
        res.push(text);
    return res;
}
function tokenizeStopTrigger(stopTrigger, tokenizer, specialTokens = false) {
    if (stopTrigger == null)
        return [];
    const res = [];
    for (const item of stopTrigger) {
        if (typeof item === "string") {
            const tokens = tokenizer(item, specialTokens, "trimLeadingSpace");
            res.push(...tokens);
        }
        else
            res.push(item);
    }
    return res;
}
//# sourceMappingURL=StopGenerationDetector.js.map