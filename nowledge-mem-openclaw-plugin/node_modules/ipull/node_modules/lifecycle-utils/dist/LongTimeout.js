const maxTimeoutDelay = 2147483647;
/**
 * A timeout that can be set to a delay longer than the maximum timeout delay supported by a regular `setTimeout`.
 *
 * For example,
 * ```typescript
 * import {LongTimeout} from "lifecycle-utils";
 *
 * const month = 1000 * 60 * 60 * 24 * 7 * 30;
 *
 * const timeout = new LongTimeout(() => {
 *     console.log("timeout");
 * }, month);
 *
 * // to clear the timeout, call dispose
 * // timeout.dispose();
 * ```
 */
export class LongTimeout {
    /** @internal */ _callback;
    /** @internal */ _startTime;
    /** @internal */ _delay;
    /** @internal */ _timeout;
    constructor(callback, delay) {
        this._callback = callback;
        this._delay = delay;
        this._startTime = Date.now();
        this._onTimeout = this._onTimeout.bind(this);
        this._timeout = setTimeout(this._onTimeout, Math.floor(Math.max(0, Math.min(delay, maxTimeoutDelay))));
    }
    dispose() {
        if (this._timeout == null)
            return;
        clearTimeout(this._timeout);
        this._timeout = undefined;
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    get disposed() {
        return this._timeout == null;
    }
    /** @internal */
    _onTimeout() {
        const currentTime = Date.now();
        const timePassed = currentTime - this._startTime;
        const timeLeft = this._delay - timePassed;
        if (timeLeft <= 0) {
            this._timeout = undefined;
            this._callback();
        }
        else
            this._timeout = setTimeout(this._onTimeout, Math.min(timeLeft, maxTimeoutDelay));
    }
}
/**
 * Sets a timeout that can also be set to a delay longer than the maximum timeout delay supported by a regular `setTimeout`.
 * You can use `clearLongTimeout` to clear the timeout.
 *
 * For example,
 * ```typescript
 * import {setLongTimeout, clearLongTimeout} from "lifecycle-utils";
 *
 * const month = 1000 * 60 * 60 * 24 * 7 * 30;
 *
 * const timeout = setLongTimeout(() => {
 *     console.log("timeout");
 * }, month);
 *
 * // to clear the timeout, call clearLongTimeout
 * // clearLongTimeout(timeout);
 * ```
 */
export function setLongTimeout(callback, delay) {
    return new LongTimeout(callback, delay);
}
/**
 * Clears a timeout that was set with `setLongTimeout`.
 * You can also clear a regular timeout with this function.
 *
 * For example,
 * ```typescript
 * import {setLongTimeout, clearLongTimeout} from "lifecycle-utils";
 *
 * const month = 1000 * 60 * 60 * 24 * 7 * 30;
 *
 * const timeout = setLongTimeout(() => {
 *     console.log("timeout");
 * }, month);
 * const timeout2 = setTimeout(() => {
 *     console.log("timeout2");
 * }, 1000 * 60);
 *
 * clearLongTimeout(timeout);
 * clearLongTimeout(timeout2);
 * ```
 */
export function clearLongTimeout(timeout) {
    if (timeout == null)
        return;
    if (timeout instanceof LongTimeout)
        timeout.dispose();
    else
        clearTimeout(timeout);
}
//# sourceMappingURL=LongTimeout.js.map