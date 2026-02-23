import { Routes } from "discord-api-types/v10";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
import { BaseGuildChannel } from "./BaseGuildChannel.js";
export class GuildThreadOnlyChannel extends BaseGuildChannel {
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
     * The topic of the channel.
     */
    get topic() {
        if (!this.rawData)
            return undefined;
        return this.rawData.topic ?? null;
    }
    /**
     * The default auto archive duration of the channel.
     */
    get defaultAutoArchiveDuration() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_auto_archive_duration ?? null;
    }
    /**
     * The default thread rate limit per user for the channel.
     */
    get defaultThreadRateLimitPerUser() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_thread_rate_limit_per_user ?? null;
    }
    /**
     * The available tags to set on posts in the channel.
     */
    get availableTags() {
        if (!this.rawData)
            return undefined;
        return this.rawData.available_tags ?? [];
    }
    /**
     * The default reaction emoji for the channel.
     */
    get defaultReactionEmoji() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_reaction_emoji;
    }
    /**
     * The default sort order for the channel, by latest activity or by creation date.
     */
    get defaultSortOrder() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_sort_order;
    }
    /**
     * You cannot send a message directly to a forum or media channel, so this method throws an error.
     * Use {@link GuildThreadChannel.send} instead, or the alias {@link GuildThreadOnlyChannel.sendToPost} instead, to send a message to the channel's posts.
     */
    async send() {
        throw new Error("You cannot send a message directly to a forum or media channel. Use GuildThreadChannel.send instead, or the alias GuildThreadOnlyChannel.sendToPost instead, to send a message to the channel's posts.");
    }
    /**
     * Send a message to a post in the channel
     * @remarks
     * This is an alias for {@link GuildThreadChannel.send} that will fetch the channel, but if you already have the channel, you can use {@link GuildThreadChannel.send} instead.
     */
    async sendToPost(message, postId) {
        const channel = new GuildThreadChannel(this.client, postId);
        return await channel.send(message);
    }
    async createPost(name, message, options) {
        const response = (await this.client.rest.post(Routes.threads(this.id), {
            body: {
                name,
                message,
                auto_archive_duration: options?.autoArchiveDuration,
                rate_limit_per_user: options?.rateLimitPerUser,
                applied_tags: options?.appliedTags
            }
        }));
        return new GuildThreadChannel(this.client, response);
    }
}
//# sourceMappingURL=GuildThreadOnlyChannel.js.map