import type { Client } from "../../classes/Client.js";
import { VoiceServerUpdateListener } from "../../classes/Listener.js";
import type { ListenerEventData } from "../../types/index.js";
/**
 * Forwards VOICE_SERVER_UPDATE events to voice adapters.
 */
export declare class VoiceServerUpdate extends VoiceServerUpdateListener {
    handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
}
//# sourceMappingURL=VoiceServerUpdateListener.d.ts.map