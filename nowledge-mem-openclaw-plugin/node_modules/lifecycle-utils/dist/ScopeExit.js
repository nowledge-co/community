/**
 * The handle returned from `scopeExit` that allows calling or skipping the provided `onExit` function.
 *
 * Calling `.call()` will call the provided `onExit` function immediately, and prevent it from being called again.
 *
 * Calling `.skip()` will prevent the `onExit` function from being called.
 *
 * If neither `.call()` nor `.skip()` is called, the `onExit` function will be called automatically when the handle is disposed.
 */
export class ScopeExitHandle {
    /** @internal */ _onExit;
    /** @internal */ _skipped;
    constructor(onExit) {
        this._onExit = onExit;
        this.call = this.call.bind(this);
        this.skip = this.skip.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
        this[Symbol.asyncDispose] = this[Symbol.asyncDispose].bind(this);
    }
    /** Whether the `onExit` function has been called */
    get called() {
        return this._onExit == null && this._skipped !== true;
    }
    /** Whether the `onExit` function has been skipped */
    get skipped() {
        return this._skipped === true;
    }
    /**
     * Call the `onExit` function immediately if it has not been called or skipped yet, and prevent it from being called again.
     */
    call() {
        if (this._onExit != null) {
            const onExit = this._onExit;
            delete this._onExit;
            return onExit();
        }
        return undefined;
    }
    /** Prevent the `onExit` function from being called if it has not been called yet */
    skip() {
        if (this._onExit == null)
            return;
        this._skipped = true;
        delete this._onExit;
    }
    [Symbol.dispose]() {
        this.call();
    }
    async [Symbol.asyncDispose]() {
        await this.call();
    }
    /** @internal */
    static _create(onExit) {
        return new ScopeExitHandle(onExit);
    }
}
/**
 * Create a scope exit handle that will call the provided callback when disposed, to be used with `using` or `await using`.
 *
 * For example, this code:
 * ```typescript
 * import {scopeExit} from "lifecycle-utils";
 *
 * function example() {
 *     using exitHandle = scopeExit(() => {
 *         console.log("exiting scope");
 *     });
 *     console.log("inside scope");
 * }
 *
 * async function asyncExample() {
 *     await using exitHandle = scopeExit(async () => {
 *         await new Promise((resolve) => setTimeout(resolve, 100));
 *         console.log("exiting async scope");
 *     });
 *     console.log("inside async scope");
 * }
 *
 * example();
 * console.log("example done");
 * console.log()
 *
 * await asyncExample();
 * console.log("asyncExample done");
 * ```
 *
 * Will print this:
 * ```
 * inside scope
 * exiting scope
 * example done
 *
 * inside async scope
 * exiting async scope
 * asyncExample done
 * ```
 */
export function scopeExit(onExit) {
    return ScopeExitHandle._create(onExit);
}
//# sourceMappingURL=ScopeExit.js.map