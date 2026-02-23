import { GuildDeleteListener } from "../../classes/Listener.js";
export class GuildDelete extends GuildDeleteListener {
    async handle(data, client) {
        const voice = client.getPlugin("voice");
        if (voice) {
            const guild_id = data.guild.id;
            voice.adapters.get(guild_id)?.destroy();
        }
    }
}
//# sourceMappingURL=GuildDeleteListener.js.map