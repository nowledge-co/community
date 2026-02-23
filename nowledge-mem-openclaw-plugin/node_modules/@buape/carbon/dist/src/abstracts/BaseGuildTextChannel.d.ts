import { type APIGuildTextChannel, type GuildTextChannelType, type RESTGetAPIChannelMessagesPinsQuery, type RESTPostAPIChannelThreadsJSONBody } from "discord-api-types/v10";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
import { Message } from "../structures/Message.js";
import type { IfPartial } from "../types/index.js";
import { BaseGuildChannel } from "./BaseGuildChannel.js";
export declare abstract class BaseGuildTextChannel<Type extends GuildTextChannelType, IsPartial extends boolean = false> extends BaseGuildChannel<Type, IsPartial> {
    rawData: APIGuildTextChannel<Type> | null;
    /**
     * The topic of the channel.
     */
    get topic(): IfPartial<IsPartial, string | null>;
    /**
     * The ID of the last message sent in the channel.
     *
     * @remarks
     * This might not always resolve to a message. The ID still stays a part of the channel's data, even if the message is deleted.
     */
    get lastMessageId(): IfPartial<IsPartial, string | null>;
    /**
     * The timestamp of the last pin in the channel.
     */
    get lastPinTimestamp(): IfPartial<IsPartial, string | null>;
    /**
     * The rate limit per user for the channel, in seconds.
     */
    get rateLimitPerUser(): IfPartial<IsPartial, number | undefined>;
    /**
     * The last message sent in the channel.
     *
     * @remarks
     * This might not always resolve to a message. The ID still stays a part of the channel's data, even if the message is deleted.
     * This will always return a partial message, so you can use {@link Message.fetch} to get the full message data.
     *
     */
    get lastMessage(): IfPartial<IsPartial, Message<true> | null>;
    /**
     * Get the pinned messages in the channel using paginated API
     * @param options Optional pagination parameters
     */
    getChannelPins(options?: RESTGetAPIChannelMessagesPinsQuery): Promise<{
        pins: {
            pinnedAt: string;
            message: Message<false>;
        }[];
        hasMore: boolean;
    }>;
    /**
     * Start a thread without an associated start message.
     * If you want to start a thread with a start message, use {@link Message.startThread}
     */
    startThread(data: RESTPostAPIChannelThreadsJSONBody): Promise<GuildThreadChannel<import("discord-api-types/v10").ThreadChannelType, false>>;
}
//# sourceMappingURL=BaseGuildTextChannel.d.ts.map