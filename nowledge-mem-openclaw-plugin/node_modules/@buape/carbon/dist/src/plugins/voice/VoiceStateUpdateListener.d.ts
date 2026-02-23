import type { Client } from "../../classes/Client.js";
import { VoiceStateUpdateListener } from "../../classes/Listener.js";
import type { ListenerEventData } from "../../types/index.js";
/**
 * Forwards VOICE_STATE_UPDATE events to voice adapters.
 */
export declare class VoiceStateUpdate extends VoiceStateUpdateListener {
    handle(data: ListenerEventData[this["type"]], client: Client): Promise<void>;
}
//# sourceMappingURL=VoiceStateUpdateListener.d.ts.map