import { VoiceServerUpdateListener } from "../../classes/Listener.js";
/**
 * Forwards VOICE_SERVER_UPDATE events to voice adapters.
 */
export class VoiceServerUpdate extends VoiceServerUpdateListener {
    async handle(data, client) {
        const voice = client.getPlugin("voice");
        if (!voice)
            return;
        const guildId = data.guild_id;
        if (guildId) {
            voice.adapters.get(guildId)?.onVoiceServerUpdate(data);
        }
    }
}
//# sourceMappingURL=VoiceServerUpdateListener.js.map