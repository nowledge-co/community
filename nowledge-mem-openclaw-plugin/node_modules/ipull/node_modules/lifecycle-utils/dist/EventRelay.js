import { DisposedError } from "./DisposedError.js";
/**
 * A simple event relay.
 * Create a listener with `createListener` and dispatch events with `dispatchEvent`.
 * For each supported event type, create a new instance of `EventRelay` and expose it as a property.
 *
 * For example, this code:
 * ```ts
 * class MyClass {
 *     public readonly onSomethingHappened = new EventRelay<string>();
 *
 *     public doSomething(whatToDo: string) {
 *         this.onSomethingHappened.dispatchEvent(whatToDo);
 *         console.log("Done notifying listeners");
 *     }
 * }
 *
 * const myClass = new MyClass();
 * myClass.onSomethingHappened.createListener((whatHappened) => {
 *     console.log(`Something happened: ${whatHappened}`);
 * });
 * myClass.doSomething("eat a cookie");
 * ```
 *
 * Will print this:
 * ```
 * Something happened: eat a cookie
 * Done notifying listeners
 * ```
 */
export class EventRelay {
    /** @internal */ _listenerCallbacks;
    /** @internal */ _disposed = false;
    constructor() {
        this._listenerCallbacks = new Map();
        this.createListener = this.createListener.bind(this);
        this.dispatchEvent = this.dispatchEvent.bind(this);
        this.clearListeners = this.clearListeners.bind(this);
        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }
    createListener(callback) {
        this._ensureNotDisposed();
        const handle = EventRelayListenerHandle._create(() => {
            const handles = this._listenerCallbacks.get(callback);
            if (handles != null) {
                handles.delete(handle);
                if (handles.size === 0)
                    this._listenerCallbacks.delete(callback);
            }
        });
        if (!this._listenerCallbacks.has(callback))
            this._listenerCallbacks.set(callback, new Set());
        this._listenerCallbacks.get(callback).add(handle);
        return handle;
    }
    createOnceListener(callback) {
        this._ensureNotDisposed();
        const handle = this.createListener((data) => {
            handle.dispose();
            callback(data);
        });
        return handle;
    }
    dispatchEvent(data) {
        for (const [listenerCallback] of Array.from(this._listenerCallbacks.entries())) {
            try {
                listenerCallback(data);
            }
            catch (err) {
                console.error(err);
            }
        }
    }
    clearListeners() {
        this._ensureNotDisposed();
        for (const handles of Array.from(this._listenerCallbacks.values())) {
            for (const handle of Array.from(handles)) {
                handle.dispose();
            }
        }
        this._listenerCallbacks.clear();
    }
    get listenerCount() {
        return this._listenerCallbacks.size;
    }
    get disposed() {
        return this._disposed;
    }
    dispose() {
        this.clearListeners();
        this._disposed = true;
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    /** @internal */
    _ensureNotDisposed() {
        if (this._disposed)
            throw new DisposedError();
    }
}
export class EventRelayListenerHandle {
    /** @internal */
    _dispose;
    constructor(dispose) {
        this._dispose = dispose;
        this.dispose = this.dispose.bind(this);
        this[Symbol.dispose] = this[Symbol.dispose].bind(this);
    }
    dispose() {
        if (this._dispose != null) {
            this._dispose();
            this._dispose = null;
        }
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    get disposed() {
        return this._dispose == null;
    }
    /** @internal */
    static _create(dispose) {
        return new EventRelayListenerHandle(dispose);
    }
}
//# sourceMappingURL=EventRelay.js.map