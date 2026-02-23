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
export declare class LongTimeout {
    constructor(callback: () => void, delay: number);
    dispose(): void;
    [Symbol.dispose](): void;
    get disposed(): boolean;
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
export declare function setLongTimeout(callback: () => void, delay: number): LongTimeout;
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
export declare function clearLongTimeout(timeout: LongTimeout | number | undefined | null | ReturnType<typeof setTimeout>): void;
