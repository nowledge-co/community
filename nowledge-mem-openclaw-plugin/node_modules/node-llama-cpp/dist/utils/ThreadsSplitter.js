import { DisposedError, DisposableHandle } from "lifecycle-utils";
export class ThreadsSplitter {
    _threadDemands = new MaxNumberCollection();
    _threadFreeCallbacks = [];
    _activeThreads = 0;
    _totalWantedThreads = 0;
    maxThreads;
    /**
     * Set to `0` to disable the limit
     * @param maxThreads
     */
    constructor(maxThreads) {
        this.maxThreads = Math.floor(Math.max(0, maxThreads));
        this._removeWantedThreads = this._removeWantedThreads.bind(this);
        this._removeThreadDemand = this._removeThreadDemand.bind(this);
    }
    createConsumer(wantedThreads, minThreads = 1) {
        if (wantedThreads !== 0 && minThreads > wantedThreads)
            minThreads = wantedThreads;
        if (this.maxThreads !== 0 && wantedThreads === 0)
            wantedThreads = this.maxThreads;
        return new ThreadsSplitterConsumer(this, wantedThreads, minThreads);
    }
    normalizeThreadsValue(threads) {
        if (this.maxThreads === 0)
            return Math.floor(Math.max(0, threads));
        return Math.floor(Math.max(0, Math.min(this.maxThreads, threads)));
    }
    /** @internal */
    _getUpdatedActiveThreads(inUsed, wanted, demanded) {
        const initialActiveThreads = this._activeThreads;
        if (inUsed > wanted)
            this._activeThreads -= inUsed - wanted;
        const idealThreads = this._calculateIdealProportion(wanted, demanded);
        let allocatedThreads = Math.min(inUsed, wanted); // already allocated
        if (allocatedThreads === idealThreads) {
            this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
            return idealThreads;
        }
        else if (allocatedThreads > idealThreads) {
            this._activeThreads -= allocatedThreads - idealThreads;
            this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
            return idealThreads;
        }
        const neededThreads = idealThreads - allocatedThreads;
        const availableThreads = this.maxThreads - this._activeThreads;
        if (neededThreads <= availableThreads) {
            this._activeThreads += neededThreads;
            this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
            return idealThreads;
        }
        allocatedThreads += availableThreads;
        this._activeThreads += availableThreads;
        this._callOnActiveThreadsFreeIfCan(initialActiveThreads);
        return allocatedThreads;
    }
    _callOnActiveThreadsFreeIfCan(lastActiveThreads) {
        if (this._activeThreads >= lastActiveThreads)
            return;
        while (this._threadFreeCallbacks.length > 0)
            this._threadFreeCallbacks.shift()?.();
    }
    _calculateIdealProportion(wantedThreads, demandedThreads) {
        return Math.min(wantedThreads, Math.max(demandedThreads, Math.ceil((wantedThreads / this._totalWantedThreads) *
            Math.max(1, this.maxThreads - (Math.max(demandedThreads, this._threadDemands.maxNumber) - demandedThreads)))));
    }
    /** @internal */
    _waitForFreeThread() {
        return new Promise((resolve) => this._threadFreeCallbacks.push(resolve));
    }
    /** @internal */
    _addWantedThreads(wantedThreads) {
        this._totalWantedThreads += wantedThreads;
    }
    /** @internal */
    _removeWantedThreads(wantedThreads) {
        this._totalWantedThreads -= wantedThreads;
    }
    /** @internal */
    _addThreadDemand(demandedThreads) {
        this._threadDemands.add(demandedThreads);
    }
    /** @internal */
    _removeThreadDemand(demandedThreads) {
        const isHighestDemand = this._threadDemands.maxNumber === demandedThreads;
        this._threadDemands.remove(demandedThreads);
        if (demandedThreads !== 0 && isHighestDemand && this._threadDemands.maxNumber !== demandedThreads) {
            while (this._threadFreeCallbacks.length > 0)
                this._threadFreeCallbacks.shift()?.();
        }
    }
}
export class ThreadsSplitterConsumer {
    _threadsSplitter;
    _wantedThreads;
    _demandedThreads;
    _wantedThreadsGcRegistry;
    _demandedThreadsGcRegistry;
    _usedThreads = 0;
    _disposed = false;
    constructor(threadsSplitter, wantedThreads, minThreads) {
        this._threadsSplitter = threadsSplitter;
        this._wantedThreads = wantedThreads;
        this._demandedThreads = minThreads;
        this._threadsSplitter._addWantedThreads(this._wantedThreads);
        this._threadsSplitter._addThreadDemand(this._demandedThreads);
        this._wantedThreadsGcRegistry = new FinalizationRegistry(this._threadsSplitter._removeWantedThreads);
        this._wantedThreadsGcRegistry.register(this, this._wantedThreads);
        this._demandedThreadsGcRegistry = new FinalizationRegistry(this._threadsSplitter._removeThreadDemand);
        this._demandedThreadsGcRegistry.register(this, this._demandedThreads);
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        this._threadsSplitter._removeWantedThreads(this._wantedThreads);
        this._threadsSplitter._removeThreadDemand(this._demandedThreads);
        this._wantedThreadsGcRegistry.unregister(this);
        this._demandedThreadsGcRegistry.unregister(this);
    }
    getAllocationToConsume() {
        if (this._disposed)
            throw new DisposedError();
        if (this._threadsSplitter.maxThreads === 0)
            return [this._wantedThreads, new DisposableHandle(() => { })];
        return this._getAsyncAllocationToConsume();
    }
    async _getAsyncAllocationToConsume() {
        do {
            this._usedThreads = this._threadsSplitter._getUpdatedActiveThreads(this._usedThreads, this._wantedThreads, this._demandedThreads);
            if (this._usedThreads < this._demandedThreads) {
                this._usedThreads = this._threadsSplitter._getUpdatedActiveThreads(this._usedThreads, 0, 0);
                await this._threadsSplitter._waitForFreeThread();
            }
        } while (this._usedThreads < this._demandedThreads);
        return [this._usedThreads, new DisposableHandle(() => {
                this._usedThreads = this._threadsSplitter._getUpdatedActiveThreads(this._usedThreads, 0, 0);
            })];
    }
}
class MaxNumberCollection {
    _countMap = new Map();
    _maxNumber = 0;
    add(number) {
        const count = this._countMap.get(number) ?? 0;
        this._countMap.set(number, count + 1);
        if (number > this._maxNumber)
            this._maxNumber = number;
    }
    remove(number) {
        const count = this._countMap.get(number);
        if (count == null)
            return;
        if (count === 1) {
            this._countMap.delete(number);
            if (number === this._maxNumber)
                this._maxNumber = this._findMaxNumber();
        }
        else
            this._countMap.set(number, count - 1);
    }
    get maxNumber() {
        return this._maxNumber;
    }
    _findMaxNumber() {
        let maxNumber = 0;
        for (const number of this._countMap.keys()) {
            if (number > maxNumber)
                maxNumber = number;
        }
        return maxNumber;
    }
}
//# sourceMappingURL=ThreadsSplitter.js.map