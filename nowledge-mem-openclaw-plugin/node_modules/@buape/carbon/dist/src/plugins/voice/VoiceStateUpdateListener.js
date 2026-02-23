import { VoiceStateUpdateListener } from "../../classes/Listener.js";
/**
 * Forwards VOICE_STATE_UPDATE events to voice adapters.
 */
export class VoiceStateUpdate extends VoiceStateUpdateListener {
    async handle(data, client) {
        const voice = client.getPlugin("voice");
        if (!voice)
            return;
        const guildId = data.guild_id;
        if (guildId) {
            // Reconstruct raw payload for @discordjs/voice adapter
            const raw = {
                ...data,
                member: data.rawMember
            };
            voice.adapters.get(guildId)?.onVoiceStateUpdate(raw);
        }
    }
}
//# sourceMappingURL=VoiceStateUpdateListener.js.map