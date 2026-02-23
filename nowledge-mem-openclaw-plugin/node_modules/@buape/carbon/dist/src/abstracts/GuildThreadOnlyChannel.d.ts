import type { APIGuildForumDefaultReactionEmoji, APIGuildForumTag, APIThreadOnlyChannel, ChannelType, SortOrderType, ThreadChannelType } from "discord-api-types/v10";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
import type { Message } from "../structures/Message.js";
import type { IfPartial, MessagePayload } from "../types/index.js";
import { BaseGuildChannel } from "./BaseGuildChannel.js";
export declare abstract class GuildThreadOnlyChannel<Type extends ChannelType.GuildForum | ChannelType.GuildMedia, IsPartial extends boolean = false> extends BaseGuildChannel<Type, IsPartial> {
    rawData: APIThreadOnlyChannel<Type> | null;
    /**
     * The position of the channel in the channel list.
     */
    get position(): IfPartial<IsPartial, number>;
    /**
     * Set the position of the channel
     * @param position The new position of the channel
     */
    setPosition(position: number): Promise<void>;
    /**
     * The topic of the channel.
     */
    get topic(): IfPartial<IsPartial, string | null>;
    /**
     * The default auto archive duration of the channel.
     */
    get defaultAutoArchiveDuration(): IfPartial<IsPartial, number | null>;
    /**
     * The default thread rate limit per user for the channel.
     */
    get defaultThreadRateLimitPerUser(): IfPartial<IsPartial, number | null>;
    /**
     * The available tags to set on posts in the channel.
     */
    get availableTags(): IfPartial<IsPartial, APIGuildForumTag[]>;
    /**
     * The default reaction emoji for the channel.
     */
    get defaultReactionEmoji(): IfPartial<IsPartial, APIGuildForumDefaultReactionEmoji | null>;
    /**
     * The default sort order for the channel, by latest activity or by creation date.
     */
    get defaultSortOrder(): IfPartial<IsPartial, SortOrderType | null>;
    /**
     * You cannot send a message directly to a forum or media channel, so this method throws an error.
     * Use {@link GuildThreadChannel.send} instead, or the alias {@link GuildThreadOnlyChannel.sendToPost} instead, to send a message to the channel's posts.
     */
    send(): Promise<never>;
    /**
     * Send a message to a post in the channel
     * @remarks
     * This is an alias for {@link GuildThreadChannel.send} that will fetch the channel, but if you already have the channel, you can use {@link GuildThreadChannel.send} instead.
     */
    sendToPost(message: MessagePayload, postId: string): Promise<Message>;
    createPost(name: string, message: MessagePayload, options?: {
        autoArchiveDuration?: number;
        rateLimitPerUser?: number;
        appliedTags?: string[];
    }): Promise<GuildThreadChannel<ThreadChannelType>>;
}
//# sourceMappingURL=GuildThreadOnlyChannel.d.ts.map