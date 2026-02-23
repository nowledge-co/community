import { DisposedError } from "./DisposedError.js";
/**
 * `AsyncDisposeAggregator` is a utility class that allows you to add multiple items and then dispose them all at once.
 * The items are disposed one by one in the order they were added.
 * You can add a function to call, an object with a `dispose` method, an object with a `Symbol.dispose` method,
 * an object with a `Symbol.asyncDispose` method, or a Promise that resolves to one of the previous types.
 * To dispose all the items, call `dispose` or use the `Symbol.asyncDispose` symbol.
 * The difference between `AsyncDisposeAggregator` and `DisposeAggregator` is that `AsyncDisposeAggregator` can dispose async targets.
 *
 * For example,
 * ```typescript
 * import {AsyncDisposeAggregator, EventRelay} from "lifecycle-utils";
 *
 * const disposeAggregator = new AsyncDisposeAggregator();
 *
 * const eventRelay = new EventRelay<string>();
 * disposeAggregator.add(eventRelay);
 *
 * disposeAggregator.add(async () => {
 *     await new Promise(resolve => setTimeout(resolve, 0));
 *     // do some async work
 * });
 *
 * disposeAggregator.dispose();
 * ```
 */
export class AsyncDisposeAggregator {
    /** @internal */ _targets = [];
    /** @internal */ _disposed = false;
    constructor() {
        this.add = this.add.bind(this);
        this.dispose = this.dispose.bind(this);
        this[Symbol.asyncDispose] = this[Symbol.asyncDispose].bind(this);
    }
    /**
     * Adds a target to be disposed.
     * You can wrap the target with a `WeakRef` to prevent this class from holding a strong reference to the target.
     */
    add(target) {
        this._ensureNotDisposed();
        this._targets.push(target);
        return this;
    }
    /**
     * Disposes all the targets that have been added and clears the list of targets.
     */
    async dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        while (this._targets.length > 0) {
            let disposeTarget = this._targets.shift();
            if (disposeTarget instanceof Promise) {
                try {
                    disposeTarget = await disposeTarget;
                }
                catch (err) {
                    /* c8 ignore start */
                    console.error(err);
                    continue;
                } /* c8 ignore stop */
            }
            if (typeof WeakRef !== "undefined" && disposeTarget instanceof WeakRef)
                disposeTarget = disposeTarget.deref();
            if (disposeTarget == null)
                continue;
            else if (Symbol.asyncDispose != null && Symbol.asyncDispose in disposeTarget &&
                disposeTarget[Symbol.asyncDispose] instanceof Function)
                await disposeTarget[Symbol.asyncDispose]();
            else if (Symbol.dispose != null && Symbol.dispose in disposeTarget &&
                disposeTarget[Symbol.dispose] instanceof Function)
                disposeTarget[Symbol.dispose]();
            else if ("dispose" in disposeTarget && disposeTarget.dispose instanceof Function)
                await disposeTarget.dispose();
            else if (disposeTarget instanceof Function)
                await disposeTarget();
        }
    }
    async [Symbol.asyncDispose]() {
        return this.dispose();
    }
    get targetCount() {
        return this._targets.length;
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this._disposed)
            throw new DisposedError();
    }
}
//# sourceMappingURL=AsyncDisposeAggregator.js.map