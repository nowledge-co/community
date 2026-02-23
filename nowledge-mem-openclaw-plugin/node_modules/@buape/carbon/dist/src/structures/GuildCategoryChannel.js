import { Routes } from "discord-api-types/v10";
import { BaseGuildChannel } from "../abstracts/BaseGuildChannel.js";
/**
 * Represents a guild category channel.
 */
export class GuildCategoryChannel extends BaseGuildChannel {
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
     * You cannot send a message to a category channel, so this method throws an error
     */
    async send() {
        throw new Error("Category channels cannot be sent to");
    }
}
//# sourceMappingURL=GuildCategoryChannel.js.map