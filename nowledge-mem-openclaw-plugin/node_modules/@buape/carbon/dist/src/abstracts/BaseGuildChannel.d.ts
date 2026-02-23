import { type APIGuildChannel, type GuildChannelType, type RESTGetAPIGuildInvitesResult, type RESTPostAPIChannelInviteJSONBody } from "discord-api-types/v10";
import { Guild } from "../structures/Guild.js";
import type { GuildCategoryChannel } from "../structures/GuildCategoryChannel.js";
import { Message } from "../structures/Message.js";
import type { IfPartial, MessagePayload } from "../types/index.js";
import { BaseChannel } from "./BaseChannel.js";
export declare abstract class BaseGuildChannel<Type extends GuildChannelType, IsPartial extends boolean = false> extends BaseChannel<Type, IsPartial> {
    rawData: APIGuildChannel<Type> | null;
    /**
     * The name of the channel.
     */
    get name(): IfPartial<IsPartial, string>;
    /**
     * The ID of the guild this channel is in
     */
    get guildId(): IfPartial<IsPartial, string>;
    /**
     * The ID of the parent category for the channel.
     */
    get parentId(): IfPartial<IsPartial, string | null>;
    /**
     * Whether the channel is marked as nsfw.
     */
    get nsfw(): IfPartial<IsPartial, boolean>;
    /**
     * The guild this channel is in
     */
    get guild(): IfPartial<IsPartial, Guild<true>>;
    /**
     * Set the name of the channel
     * @param name The new name of the channel
     */
    setName(name: string): Promise<void>;
    /**
     * Set the parent ID of the channel
     * @param parent The new category channel or ID to set
     */
    setParent(parent: GuildCategoryChannel | string): Promise<void>;
    /**
     * Set whether the channel is nsfw
     * @param nsfw The new nsfw status of the channel
     */
    setNsfw(nsfw: boolean): Promise<void>;
    /**
     * Send a message to the channel
     */
    send(message: MessagePayload): Promise<Message<false>>;
    /**
     * Get the invites for the channel
     */
    getInvites(): Promise<RESTGetAPIGuildInvitesResult>;
    /**
     * Create an invite for the channel
     */
    createInvite(options?: RESTPostAPIChannelInviteJSONBody): Promise<import("discord-api-types/v10").APIExtendedInvite>;
    /**
     * Trigger a typing indicator in the channel (this will expire after 10 seconds)
     */
    triggerTyping(): Promise<void>;
}
//# sourceMappingURL=BaseGuildChannel.d.ts.map