/**
 * An object that provides a `.dispose()` method that can called only once.
 *
 * Calling `.dispose()` will call the provided `onDispose` function only once.
 * Any subsequent calls to `.dispose()` will do nothing.
 */
export class DisposableHandle {
    /** @internal */ _onDispose;
    constructor(onDispose) {
        this._onDispose = onDispose;
        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }
    get disposed() {
        return this._onDispose == null;
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    dispose() {
        if (this._onDispose != null) {
            const onDispose = this._onDispose;
            delete this._onDispose;
            onDispose();
        }
    }
}
//# sourceMappingURL=DisposableHandle.js.map