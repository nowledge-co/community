import { DisposedError } from "./DisposedError.js";
/**
 * `DisposeAggregator` is a utility class that allows you to add multiple items and then dispose them all at once.
 * You can add a function to call, an object with a `dispose` method, or an object with a `Symbol.dispose` method.
 * To dispose all the items, call `dispose` or use the `Symbol.dispose` symbol.
 *
 * For example,
 * ```typescript
 * const disposeAggregator = new DisposeAggregator();
 *
 * const eventRelay = new EventRelay<string>();
 * disposeAggregator.add(eventRelay);
 *
 * const eventRelay2 = disposeAggregator.add(new EventRelay<string>());
 *
 * disposeAggregator.dispose();
 * console.log(eventRelay.disposed === true); // true
 * console.log(eventRelay2.disposed === true); // true
 * ```
 */
export class DisposeAggregator {
    /** @internal */ _targets = [];
    /** @internal */ _disposed = false;
    constructor() {
        this.add = this.add.bind(this);
        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }
    /**
     * Adds a target to be disposed.
     * You can wrap the target with a `WeakRef` to prevent this class from holding a strong reference to the target.
     */
    add(target) {
        this._ensureNotDisposed();
        this._targets.push(target);
        return target;
    }
    /**
     * Disposes all the targets that have been added and clears the list of targets.
     */
    dispose() {
        if (this._disposed)
            return;
        while (this._targets.length > 0) {
            let disposeTarget = this._targets.shift();
            if (typeof WeakRef !== "undefined" && disposeTarget instanceof WeakRef)
                disposeTarget = disposeTarget.deref();
            if (disposeTarget == null)
                continue;
            else if (Symbol.dispose != null && Symbol.dispose in disposeTarget && disposeTarget[Symbol.dispose] instanceof Function)
                disposeTarget[Symbol.dispose]();
            else if ("dispose" in disposeTarget && disposeTarget.dispose instanceof Function)
                disposeTarget.dispose();
            else if (disposeTarget instanceof Function)
                disposeTarget();
        }
        this._disposed = true;
    }
    [Symbol.dispose]() {
        this.dispose();
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
//# sourceMappingURL=DisposeAggregator.js.map