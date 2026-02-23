import type { Client } from "../../classes/Client.js";
import { InteractionCreateListener } from "../../classes/Listener.js";
import { type ListenerEventData } from "../../types/listeners.js";
export declare class InteractionEventListener extends InteractionCreateListener {
    readonly type = GatewayDispatchEvents.InteractionCreate;
    handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
}
//# sourceMappingURL=InteractionEventListener.d.ts.map