import type { Client } from "../classes/Client.js";
import type { ListenerEventAdditionalData, ListenerEventData, ListenerEventRawData, ListenerEventType } from "../types/listeners.js";
/**
 * Base class for creating event listeners that handle Discord gateway events.
 * This abstract class defines the structure for event listeners and provides type safety for event handling.
 * @abstract
 */
export declare abstract class BaseListener {
    abstract readonly type: ListenerEventType;
    abstract handle(data: ListenerEventData[this["type"]] & ListenerEventAdditionalData, client: Client): Promise<void>;
    abstract parseRawData(data: ListenerEventRawData[this["type"]] & ListenerEventAdditionalData, client: Client): ListenerEventData[this["type"]];
}
//# sourceMappingURL=BaseListener.d.ts.map