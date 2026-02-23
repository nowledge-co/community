import type { Client } from "../classes/Client.js";
import type { ListenerEventAdditionalData, ListenerEventRawData } from "../types/index.js";
export interface EventQueueOptions {
    /**
     * Maximum number of events that can be queued before backpressure is applied
     * @default 10000
     */
    maxQueueSize?: number;
    /**
     * Maximum number of concurrent event processing operations
     * @default 50
     */
    maxConcurrency?: number;
    /**
     * Maximum time (in ms) a single listener can take before timing out
     * @default 30000 (30 seconds)
     */
    listenerTimeout?: number;
    listenerConcurrency?: number;
    yieldIntervalMs?: number;
    /**
     * Whether to log slow listeners
     * @default true
     */
    logSlowListeners?: boolean;
    /**
     * Threshold (in ms) for logging slow listeners
     * @default 1000 (1 second)
     */
    slowListenerThreshold?: number;
}
export declare class EventQueue {
    private client;
    private queue;
    private processing;
    private options;
    private lastYieldAt;
    private processedCount;
    private droppedCount;
    private timeoutCount;
    constructor(client: Client, options?: EventQueueOptions);
    enqueue<T extends keyof ListenerEventRawData>(payload: ListenerEventRawData[T] & ListenerEventAdditionalData, type: T): boolean;
    private processNext;
    private processEvent;
    private processListener;
    private maybeYield;
    getMetrics(): {
        queueSize: number;
        processing: number;
        processed: number;
        dropped: number;
        timeouts: number;
        maxQueueSize: number;
        maxConcurrency: number;
    };
    hasCapacity(): boolean;
    getUtilization(): number;
}
//# sourceMappingURL=EventQueue.d.ts.map