import { DisposedError } from "lifecycle-utils";
import { maxRecentDetokenizerTokens } from "../consts.js";
import { pushAll } from "./pushAll.js";
export class TokenStreamRegulator {
    /** @internal */ _queue = [];
    /** @internal */ _LastTokens = [];
    addChunk({ tokens, text }) {
        const queuedRelease = QueuedTokenRelease._create(tokens, text);
        this._queue.push(queuedRelease);
        return queuedRelease;
    }
    popFreeChunkTokens() {
        const res = [];
        while (this._queue.length > 0 && this._queue[0].isFree) {
            const tokens = this._queue.shift().tokens;
            pushAll(res, tokens);
            pushAll(this._LastTokens, tokens);
        }
        if (this._LastTokens.length > maxRecentDetokenizerTokens)
            this._LastTokens.splice(0, this._LastTokens.length - maxRecentDetokenizerTokens);
        return res;
    }
    getPartiallyFreeChunk(tokenizer) {
        if (this._queue.length > 0 && this._queue[0].isPartiallyFree) {
            const queuedRelease = this._queue[0];
            if (queuedRelease.hasTextLocks && !queuedRelease.hasTokenLocks)
                return {
                    tokens: [],
                    text: queuedRelease.text.slice(0, queuedRelease.getFreeTextIndex())
                };
            else if (queuedRelease.hasTokenLocks && !queuedRelease.hasTextLocks) {
                const tokens = queuedRelease.tokens.slice(0, queuedRelease.getFreeTokenIndex());
                return {
                    tokens,
                    text: tokenizer.detokenize(tokens, false, this._LastTokens)
                };
            }
            const freeTokenIndex = queuedRelease.getFreeTokenIndex();
            const tokens = queuedRelease.tokens.slice(0, freeTokenIndex);
            const tokensText = tokenizer.detokenize(tokens, false, this._LastTokens);
            const freeTextIndex = queuedRelease.getFreeTextIndex();
            const text = queuedRelease.text.slice(0, freeTextIndex);
            if (text.length > tokensText.length) {
                return {
                    tokens,
                    text: tokensText
                };
            }
            else if (text.length < tokensText.length) {
                const resTokens = [];
                let resTokensText = "";
                const lastTokens = this._LastTokens.slice();
                for (const token of tokens) {
                    const tokenText = tokenizer.detokenize([token], false, lastTokens);
                    lastTokens.push(token);
                    // ensure partial tokens are detokenized correctly
                    if (resTokensText.length + tokenText.length > text.length)
                        resTokensText = tokenizer.detokenize(resTokens, false, this._LastTokens);
                    if (resTokensText.length + tokenText.length > text.length) {
                        const remainingText = text.slice(resTokensText.length);
                        const remainingTokens = tokenizer(remainingText, false, "trimLeadingSpace");
                        pushAll(resTokens, remainingTokens);
                        break;
                    }
                    resTokens.push(token);
                    resTokensText += tokenText;
                }
                return {
                    tokens: resTokens,
                    text
                };
            }
            return {
                tokens: queuedRelease.tokens.slice(0, freeTokenIndex),
                text: queuedRelease.text.slice(0, freeTextIndex)
            };
        }
        return {
            tokens: [],
            text: ""
        };
    }
    getAllQueuedChunkTokens() {
        return this._queue.flatMap((queuedRelease) => queuedRelease.tokens);
    }
    getLastQueuedChunkTokens(maxTokens = maxRecentDetokenizerTokens) {
        const res = [];
        for (let i = this._queue.length - 1; i >= 0 && res.length < maxTokens; i--) {
            const tokens = this._queue[i].tokens;
            for (let j = tokens.length - 1; j >= 0 && res.length < maxTokens; j--)
                res.unshift(tokens[j]);
        }
        return this._queue.flatMap((queuedRelease) => queuedRelease.tokens);
    }
    clearQueue() {
        this._queue.length = 0;
    }
    reset() {
        this.clearQueue();
        this._LastTokens.length = 0;
    }
    removeChunkIfLast(queuedTokenRelease) {
        if (this._queue.at(-1) === queuedTokenRelease)
            return this._queue.pop() != null;
        return false;
    }
}
export class QueuedTokenRelease {
    /** @internal */ _textLocks = new Set();
    /** @internal */ _tokenLocks = new Set();
    /** @internal */ _tokens;
    /** @internal */ _text;
    constructor(tokens, text) {
        this._tokens = tokens;
        this._text = text;
    }
    get tokens() {
        return this._tokens;
    }
    get text() {
        return this._text;
    }
    get isFree() {
        return this._textLocks.size === 0 && this._tokenLocks.size === 0;
    }
    get hasTextLocks() {
        return this._textLocks.size > 0;
    }
    get hasTokenLocks() {
        return this._tokenLocks.size > 0;
    }
    get isPartiallyFree() {
        if (this.isFree)
            return true;
        const freeTextIndex = this.getFreeTextIndex();
        const freeTokenIndex = this.getFreeTokenIndex();
        return freeTextIndex > 0 && freeTokenIndex > 0;
    }
    getFreeTextIndex() {
        if (this._textLocks.size === 0)
            return this.text.length;
        return [...this._textLocks]
            .reduce((res, lock) => Math.min(res, lock.index), this.text.length);
    }
    getFreeTokenIndex() {
        if (this._tokenLocks.size === 0)
            return this.tokens.length;
        return [...this._tokenLocks]
            .reduce((res, lock) => Math.min(res, lock.index), this.tokens.length);
    }
    createTextIndexLock(startIndex) {
        const lock = QueuedTokenReleaseLock._create(startIndex, this._textLocks);
        if (startIndex >= 0 && startIndex < this.text.length)
            this._textLocks.add(lock);
        return lock;
    }
    createTokenIndexLock(startIndex) {
        const lock = QueuedTokenReleaseLock._create(startIndex, this._tokenLocks);
        if (startIndex >= 0 && startIndex < this.tokens.length)
            this._tokenLocks.add(lock);
        return lock;
    }
    modifyTokensAndText(tokens, text) {
        this._tokens = tokens;
        this._text = text;
    }
    /** @internal */
    static _create(tokens, text) {
        return new QueuedTokenRelease(tokens, text);
    }
}
export class QueuedTokenReleaseLock {
    /** @internal */ _index;
    /** @internal */ _locks;
    constructor(index, locks) {
        this._index = index;
        this._locks = locks;
    }
    get index() {
        return this._index;
    }
    duplicate() {
        if (!this._locks.has(this))
            throw new DisposedError();
        const lock = QueuedTokenReleaseLock._create(this._index, this._locks);
        this._locks.add(lock);
        return lock;
    }
    dispose() {
        this._locks.delete(this);
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    /** @internal */
    static _create(length, locks) {
        return new QueuedTokenReleaseLock(length, locks);
    }
}
//# sourceMappingURL=TokenStreamRegulator.js.map