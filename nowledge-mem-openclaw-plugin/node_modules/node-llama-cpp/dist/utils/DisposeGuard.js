import { DisposedError } from "lifecycle-utils";
export class DisposeGuard {
    /** @internal */ _preventionHandles = 0;
    /** @internal */ _awaitingDisposeLockCallbacks = [];
    /** @internal */ _disposeActivated = false;
    /** @internal */ _parentDisposeGuardsLocks = new Map();
    constructor(parentDisposeGuards = []) {
        for (const parent of parentDisposeGuards)
            this._parentDisposeGuardsLocks.set(parent, null);
    }
    addParentDisposeGuard(parent) {
        if (this._parentDisposeGuardsLocks.has(parent))
            return;
        this._parentDisposeGuardsLocks.set(parent, null);
        if (this._preventionHandles > 0)
            this._parentDisposeGuardsLocks.set(parent, parent.createPreventDisposalHandle(true));
    }
    removeParentDisposeGuard(parent) {
        const parentLock = this._parentDisposeGuardsLocks.get(parent);
        if (parentLock != null) {
            parentLock.dispose();
            this._parentDisposeGuardsLocks.delete(parent);
        }
    }
    async acquireDisposeLock() {
        return new Promise((accept) => {
            if (this._preventionHandles > 0)
                this._awaitingDisposeLockCallbacks.push(accept);
            else {
                this._disposeActivated = true;
                accept();
            }
        });
    }
    createPreventDisposalHandle(ignoreAwaitingDispose = false) {
        if (this._isDisposeActivated() || (!ignoreAwaitingDispose && this._hasAwaitingDisposeLocks()))
            throw new DisposedError();
        this._preventionHandles++;
        try {
            this._updateParentDisposeGuardLocks();
        }
        catch (err) {
            this._preventionHandles--;
            if (this._preventionHandles === 0)
                this._updateParentDisposeGuardLocks();
            throw err;
        }
        return DisposalPreventionHandle._create(() => {
            this._preventionHandles--;
            this._activateLocksIfNeeded();
            this._updateParentDisposeGuardLocks(true);
        });
    }
    /** @internal */
    _isDisposeActivated() {
        if (this._disposeActivated)
            return true;
        return [...this._parentDisposeGuardsLocks.keys()].some((parent) => parent._isDisposeActivated());
    }
    /** @internal */
    _activateLocksIfNeeded() {
        if (this._preventionHandles > 0)
            return;
        while (this._awaitingDisposeLockCallbacks.length > 0) {
            this._disposeActivated = true;
            this._awaitingDisposeLockCallbacks.shift()();
        }
    }
    /** @internal */
    _updateParentDisposeGuardLocks(onlyAllowRemoval = false) {
        if (this._preventionHandles === 0) {
            for (const parent of this._parentDisposeGuardsLocks.keys()) {
                const parentLock = this._parentDisposeGuardsLocks.get(parent);
                if (parentLock == null)
                    continue;
                parentLock.dispose();
                this._parentDisposeGuardsLocks.set(parent, null);
            }
        }
        else if (!onlyAllowRemoval) {
            for (const parent of this._parentDisposeGuardsLocks.keys()) {
                if (this._parentDisposeGuardsLocks.get(parent) != null)
                    continue;
                this._parentDisposeGuardsLocks.set(parent, parent.createPreventDisposalHandle(true));
            }
        }
    }
    /** @internal */
    _hasAwaitingDisposeLocks() {
        if (this._awaitingDisposeLockCallbacks.length > 0)
            return true;
        return [...this._parentDisposeGuardsLocks.keys()].some((parent) => parent._hasAwaitingDisposeLocks());
    }
}
export class DisposalPreventionHandle {
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
        return new DisposalPreventionHandle(dispose);
    }
}
//# sourceMappingURL=DisposeGuard.js.map