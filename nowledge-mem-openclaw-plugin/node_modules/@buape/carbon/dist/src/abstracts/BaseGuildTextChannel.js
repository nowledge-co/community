import { Routes } from "discord-api-types/v10";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
import { Message } from "../structures/Message.js";
import { BaseGuildChannel } from "./BaseGuildChannel.js";
export class BaseGuildTextChannel extends BaseGuildChannel {
    /**
     * The topic of the channel.
     */
    get topic() {
        if (!this.rawData)
            return undefined;
        return this.rawData.topic ?? null;
    }
    /**
     * The ID of the last message sent in the channel.
     *
     * @remarks
     * This might not always resolve to a message. The ID still stays a part of the channel's data, even if the message is deleted.
     */
    get lastMessageId() {
        if (!this.rawData)
            return undefined;
        return this.rawData.last_message_id ?? null;
    }
    /**
     * The timestamp of the last pin in the channel.
     */
    get lastPinTimestamp() {
        if (!this.rawData)
            return undefined;
        return this.rawData.last_pin_timestamp ?? null;
    }
    /**
     * The rate limit per user for the channel, in seconds.
     */
    get rateLimitPerUser() {
        if (!this.rawData)
            return undefined;
        return this.rawData.rate_limit_per_user;
    }
    /**
     * The last message sent in the channel.
     *
     * @remarks
     * This might not always resolve to a message. The ID still stays a part of the channel's data, even if the message is deleted.
     * This will always return a partial message, so you can use {@link Message.fetch} to get the full message data.
     *
     */
    get lastMessage() {
        if (!this.rawData)
            return undefined;
        if (!this.lastMessageId)
            return null;
        return new Message(this.client, {
            id: this.lastMessageId,
            channelId: this.id
        });
    }
    /**
     * Get the pinned messages in the channel using paginated API
     * @param options Optional pagination parameters
     */
    async getChannelPins(options) {
        const queryParams = {};
        if (options?.before)
            queryParams.before = options.before;
        if (options?.limit)
            queryParams.limit = options.limit.toString();
        const result = (await this.client.rest.get(Routes.channelMessagesPins(this.id), Object.keys(queryParams).length > 0 ? queryParams : undefined));
        return {
            pins: result.items.map((pin) => ({
                pinnedAt: pin.pinned_at,
                message: new Message(this.client, pin.message)
            })),
            hasMore: result.has_more
        };
    }
    /**
     * Start a thread without an associated start message.
     * If you want to start a thread with a start message, use {@link Message.startThread}
     */
    async startThread(data) {
        const thread = (await this.client.rest.post(Routes.threads(this.id), {
            body: { ...data }
        }));
        return new GuildThreadChannel(this.client, thread);
    }
}
//# sourceMappingURL=BaseGuildTextChannel.js.map