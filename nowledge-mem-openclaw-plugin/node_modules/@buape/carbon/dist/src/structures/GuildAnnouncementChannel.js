import { Routes } from "discord-api-types/v10";
import { BaseGuildTextChannel } from "../abstracts/BaseGuildTextChannel.js";
/**
 * Represents a guild announcement channel.
 */
export class GuildAnnouncementChannel extends BaseGuildTextChannel {
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
    async follow(targetChannel) {
        await this.client.rest.put(Routes.channelFollowers(this.id), {
            body: {
                webhook_channel_id: typeof targetChannel === "string" ? targetChannel : targetChannel.id
            }
        });
    }
}
//# sourceMappingURL=GuildAnnouncementChannel.js.map