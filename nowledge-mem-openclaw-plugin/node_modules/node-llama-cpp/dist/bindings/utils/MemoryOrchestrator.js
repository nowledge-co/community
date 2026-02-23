import { EventRelay } from "lifecycle-utils";
export class MemoryOrchestrator {
    /** @internal */ _getMemoryState;
    /** @internal */ _reservedMemory = 0;
    onMemoryReservationRelease = new EventRelay();
    constructor(getMemoryState) {
        this._getMemoryState = getMemoryState;
    }
    reserveMemory(bytes) {
        this._reservedMemory += bytes;
        return MemoryReservation._create(bytes, () => {
            this._reservedMemory -= bytes;
            this.onMemoryReservationRelease.dispatchEvent();
        });
    }
    async getMemoryState() {
        const { free, total, unifiedSize } = this._getMemoryState();
        return {
            free: Math.max(0, free - this._reservedMemory),
            total,
            unifiedSize
        };
    }
}
export class MemoryReservation {
    /** @internal */ _size;
    /** @internal */ _dispose;
    constructor(size, dispose) {
        this._size = size;
        this._dispose = dispose;
    }
    get size() {
        return this._size;
    }
    get disposed() {
        return this._dispose == null;
    }
    [Symbol.dispose]() {
        this.dispose();
    }
    dispose() {
        if (this._dispose != null)
            this._dispose();
        this._dispose = null;
    }
    static _create(bytes, dispose) {
        return new MemoryReservation(bytes, dispose);
    }
}
//# sourceMappingURL=MemoryOrchestrator.js.map