import { DisposableHandle } from "lifecycle-utils";
import type { Promisable } from "./transformPromisable.js";
export declare class ThreadsSplitter {
    private readonly _threadDemands;
    private readonly _threadFreeCallbacks;
    private _activeThreads;
    private _totalWantedThreads;
    maxThreads: number;
    /**
     * Set to `0` to disable the limit
     * @param maxThreads
     */
    constructor(maxThreads: number);
    createConsumer(wantedThreads: number, minThreads?: number): ThreadsSplitterConsumer;
    normalizeThreadsValue(threads: number): number;
    private _callOnActiveThreadsFreeIfCan;
    private _calculateIdealProportion;
}
export declare class ThreadsSplitterConsumer {
    private readonly _threadsSplitter;
    private readonly _wantedThreads;
    private readonly _demandedThreads;
    private readonly _wantedThreadsGcRegistry;
    private readonly _demandedThreadsGcRegistry;
    private _usedThreads;
    private _disposed;
    constructor(threadsSplitter: ThreadsSplitter, wantedThreads: number, minThreads: number);
    [Symbol.dispose](): void;
    dispose(): void;
    getAllocationToConsume(): Promisable<[threadsToUse: number, usageHandle: DisposableHandle]>;
    private _getAsyncAllocationToConsume;
}
