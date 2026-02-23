/**
 * An object that provides an async `.dispose()` method that can called only once.
 *
 * Calling `.dispose()` will call the provided `onDispose` function only once.
 * Any subsequent calls to `.dispose()` will do nothing.
 */
export class AsyncDisposableHandle {
    /** @internal */ _onDispose;
    /** @internal */ _disposePromise;
    constructor(onDispose) {
        this._onDispose = onDispose;
        this.dispose = this.dispose.bind(this);
        this[Symbol.asyncDispose] = this[Symbol.asyncDispose].bind(this);
    }
    get disposed() {
        return this._onDispose == null;
    }
    async [Symbol.asyncDispose]() {
        await this.dispose();
    }
    async dispose() {
        if (this._onDispose != null) {
            const onDispose = this._onDispose;
            delete this._onDispose;
            this._disposePromise = onDispose();
            await this._disposePromise;
        }
        await this._disposePromise;
    }
}
//# sourceMappingURL=AsyncDisposableHandle.js.map