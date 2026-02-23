import { Base } from "../abstracts/Base.js";
import { EventQueue } from "./EventQueue.js";
/**
 * Handles Discord gateway events and dispatches them to registered listeners.
 * @internal
 */
export class EventHandler extends Base {
    eventQueue;
    constructor(client) {
        super(client);
        this.eventQueue = new EventQueue(client, client.options.eventQueue);
    }
    handleEvent(payload, type) {
        return this.eventQueue.enqueue(payload, type);
    }
    getMetrics() {
        return this.eventQueue.getMetrics();
    }
    hasCapacity() {
        return this.eventQueue.hasCapacity();
    }
}
//# sourceMappingURL=EventHandler.js.map