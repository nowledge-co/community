import type { Client } from "../../classes/Client.js";
import { GuildDeleteListener } from "../../classes/Listener.js";
import type { ListenerEventData } from "../../types/index.js";
export declare class GuildDelete extends GuildDeleteListener {
    handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
}
//# sourceMappingURL=GuildDeleteListener.d.ts.map