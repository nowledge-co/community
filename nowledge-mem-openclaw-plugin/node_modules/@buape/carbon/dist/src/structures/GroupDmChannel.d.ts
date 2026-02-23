import { type ChannelType } from "discord-api-types/v10";
import { BaseChannel } from "../abstracts/BaseChannel.js";
import type { IfPartial } from "../types/index.js";
import { type CDNUrlOptions } from "../utils/index.js";
import { Message } from "./Message.js";
import { User } from "./User.js";
/**
 * Represents a group DM channel.
 */
export declare class GroupDmChannel<IsPartial extends boolean = false> extends BaseChannel<ChannelType.GroupDM, IsPartial> {
    /**
     * The name of the channel.
     */
    get name(): IfPartial<IsPartial, string | null>;
    /**
     * The recipients of the channel.
     */
    get recipients(): IfPartial<IsPartial, User<boolean>[]>;
    /**
     * The ID of the application that created the channel, if it was created by a bot.
     */
    get applicationId(): IfPartial<IsPartial, string | null>;
    /**
     * The icon hash of the channel.
     */
    get icon(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the channel's icon with default settings (png format)
     */
    get iconUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the channel's icon with custom format and size options
     * @param options Optional format and size parameters
     * @returns The icon URL or null if no icon is set
     */
    getIconUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * The ID of the user who created the channel.
     */
    get ownerId(): IfPartial<IsPartial, string | null>;
    /**
     * The ID of the last message sent in the channel.
     *
     * @remarks
     * This might not always resolve to a message. The ID still stays a part of the channel's data, even if the message is deleted.
     */
    get lastMessageId(): IfPartial<IsPartial, string | null>;
    /**
     * Whether the channel is managed by an Oauth2 application.
     */
    get managed(): IfPartial<IsPartial, boolean>;
    /**
     * Get the owner of the channel.
     */
    get owner(): User<true>;
    /**
     * The last message sent in the channel.
     *
     * @remarks
     * This might not always resolve to a message. The ID still stays a part of the channel's data, even if the message is deleted.
     * This will always return a partial message, so you can use {@link Message.fetch} to get the full message data.
     *
     */
    get lastMessage(): Message<true> | null;
    /**
     * Set the name of the channel
     * @param name The new name of the channel
     */
    setName(name: string): Promise<void>;
    /**
     * Trigger a typing indicator in the channel (this will expire after 10 seconds)
     */
    triggerTyping(): Promise<void>;
}
//# sourceMappingURL=GroupDmChannel.d.ts.map