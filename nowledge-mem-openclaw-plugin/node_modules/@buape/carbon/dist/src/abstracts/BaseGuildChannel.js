import { Routes } from "discord-api-types/v10";
import { Guild } from "../structures/Guild.js";
import { Message } from "../structures/Message.js";
import { serializePayload } from "../utils/index.js";
import { BaseChannel } from "./BaseChannel.js";
export class BaseGuildChannel extends BaseChannel {
    /**
     * The name of the channel.
     */
    get name() {
        if (!this.rawData)
            return undefined;
        return this.rawData.name;
    }
    /**
     * The ID of the guild this channel is in
     */
    get guildId() {
        if (!this.rawData)
            return undefined;
        return this.rawData.guild_id;
    }
    /**
     * The ID of the parent category for the channel.
     */
    get parentId() {
        if (!this.rawData)
            return undefined;
        return this.rawData.parent_id ?? null;
    }
    /**
     * Whether the channel is marked as nsfw.
     */
    get nsfw() {
        if (!this.rawData)
            return undefined;
        return this.rawData.nsfw ?? false;
    }
    /**
     * The guild this channel is in
     */
    get guild() {
        if (!this.rawData)
            return undefined;
        if (!this.guildId)
            throw new Error("Cannot get guild without guild ID");
        return new Guild(this.client, this.guildId);
    }
    /**
     * Set the name of the channel
     * @param name The new name of the channel
     */
    async setName(name) {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: {
                name
            }
        });
        this.setField("name", name);
    }
    /**
     * Set the parent ID of the channel
     * @param parent The new category channel or ID to set
     */
    async setParent(parent) {
        if (typeof parent === "string") {
            await this.client.rest.patch(Routes.channel(this.id), {
                body: {
                    parent_id: parent
                }
            });
            this.setField("parent_id", parent);
        }
        else {
            await this.client.rest.patch(Routes.channel(this.id), {
                body: {
                    parent_id: parent.id
                }
            });
            this.setField("parent_id", parent.id);
        }
    }
    /**
     * Set whether the channel is nsfw
     * @param nsfw The new nsfw status of the channel
     */
    async setNsfw(nsfw) {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: {
                nsfw
            }
        });
        this.setField("nsfw", nsfw);
    }
    /**
     * Send a message to the channel
     */
    async send(message) {
        const data = (await this.client.rest.post(Routes.channelMessages(this.id), {
            body: serializePayload(message)
        }));
        return new Message(this.client, data);
    }
    /**
     * Get the invites for the channel
     */
    async getInvites() {
        return (await this.client.rest.get(Routes.channelInvites(this.id)));
    }
    /**
     * Create an invite for the channel
     */
    async createInvite(options) {
        return (await this.client.rest.post(Routes.channelInvites(this.id), {
            body: { ...options }
        }));
    }
    /**
     * Trigger a typing indicator in the channel (this will expire after 10 seconds)
     */
    async triggerTyping() {
        await this.client.rest.post(Routes.channelTyping(this.id), {});
    }
}
//# sourceMappingURL=BaseGuildChannel.js.map