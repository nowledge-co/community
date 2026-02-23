import { Routes } from "discord-api-types/v10";
import { BaseGuildTextChannel } from "../abstracts/BaseGuildTextChannel.js";
export class GuildTextChannel extends BaseGuildTextChannel {
    /**
     * The position of the channel in the channel list.
     */
    get position() {
        if (!this.rawData)
            return undefined;
        return this.rawData.position;
    }
    /**
     * Set the position of the channel
     * @param position The new position of the channel
     */
    async setPosition(position) {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: {
                position
            }
        });
        this.setField("position", position);
    }
    /**
     * The default auto archive duration of threads in the channel.
     */
    get defaultAutoArchiveDuration() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_auto_archive_duration ?? null;
    }
    /**
     * The default thread rate limit per user of the channel.
     */
    get defaultThreadRateLimitPerUser() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_thread_rate_limit_per_user ?? null;
    }
}
//# sourceMappingURL=GuildTextChannel.js.map