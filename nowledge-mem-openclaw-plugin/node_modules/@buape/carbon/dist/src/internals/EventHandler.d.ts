import { Base } from "../abstracts/Base.js";
import type { ListenerEventAdditionalData, ListenerEventRawData } from "../types/index.js";
/**
 * Handles Discord gateway events and dispatches them to registered listeners.
 * @internal
 */
export declare class EventHandler extends Base {
    private eventQueue;
    constructor(client: typeof Base.prototype.client);
    handleEvent<T extends keyof ListenerEventRawData>(payload: ListenerEventRawData[T] & ListenerEventAdditionalData, type: T): boolean;
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
}
//# sourceMappingURL=EventHandler.d.ts.map