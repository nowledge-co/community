import { type APIAttachment, type APIMessage, type APIMessageInteractionMetadata, type APIMessageReference, type APIReaction, type APIStickerItem, type ChannelType, type MessageFlags, type MessageType, type RESTPostAPIChannelThreadsJSONBody } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import { Embed } from "../classes/Embed.js";
import type { IfPartial, MessagePayload } from "../types/index.js";
import { GuildThreadChannel } from "./GuildThreadChannel.js";
import { Poll } from "./Poll.js";
import { Role } from "./Role.js";
import { User } from "./User.js";
export declare class Message<IsPartial extends boolean = false> extends Base {
    constructor(client: Client, rawDataOrIds: IsPartial extends true ? {
        id: string;
        channelId?: string;
    } : APIMessage);
    protected _rawData: APIMessage | null;
    private setData;
    /**
     * The raw Discord API data for this message
     */
    get rawData(): Readonly<APIMessage>;
    /**
     * The ID of the message
     */
    readonly id: string;
    /**
     * The ID of the channel the message is in
     */
    readonly channelId: string;
    /**
     * Whether the message is a partial message (meaning it does not have all the data).
     * If this is true, you should use {@link Message.fetch} to get the full data of the message.
     */
    get partial(): IsPartial;
    /**
     * If this message is a response to an interaction, this is the ID of the interaction's application
     */
    get applicationId(): IfPartial<IsPartial, string | undefined>;
    /**
     * The attachments of the message
     */
    get attachments(): IfPartial<IsPartial, APIAttachment[]>;
    /**
     * The components of the message
     */
    get components(): IfPartial<IsPartial, NonNullable<APIMessage["components"]>>;
    /**
     * The content of the message
     */
    get content(): IfPartial<IsPartial, string>;
    get embeds(): IfPartial<IsPartial, Embed[]>;
    /**
     * If this message was edited, this is the timestamp of the edit
     */
    get editedTimestamp(): IfPartial<IsPartial, string | null>;
    /**
     * The flags of the message
     */
    get flags(): IfPartial<IsPartial, MessageFlags>;
    /**
     * The interaction metadata of the message
     */
    get interactionMetadata(): IfPartial<IsPartial, APIMessageInteractionMetadata | undefined>;
    /**
     * Whether the message mentions everyone
     */
    get mentionedEveryone(): IfPartial<IsPartial, boolean>;
    /**
     * The users mentioned in the message
     */
    get mentionedUsers(): IfPartial<IsPartial, User[]>;
    /**
     * The roles mentioned in the message
     */
    get mentionedRoles(): IfPartial<IsPartial, Role<true>[]>;
    /**
     * The data about the referenced message. You can use {@link Message.referencedMessage} to get the referenced message itself.
     */
    get messageReference(): IfPartial<IsPartial, APIMessageReference | undefined>;
    /**
     * The referenced message itself
     */
    get referencedMessage(): IfPartial<IsPartial, Message | null>;
    /**
     * Whether the message is pinned
     */
    get pinned(): IfPartial<IsPartial, boolean>;
    /**
     * The poll contained in the message
     */
    get poll(): IfPartial<IsPartial, Poll | undefined>;
    /**
     * The approximate position of the message in the channel
     */
    get position(): IfPartial<IsPartial, number | undefined>;
    /**
     * The reactions on the message
     */
    get reactions(): IfPartial<IsPartial, APIReaction[]>;
    /**
     * The stickers in the message
     */
    get stickers(): IfPartial<IsPartial, APIStickerItem[]>;
    /**
     * The timestamp of the original message
     */
    get timestamp(): IfPartial<IsPartial, string>;
    /**
     * Whether the message is a TTS message
     */
    get tts(): IfPartial<IsPartial, boolean>;
    /**
     * The type of the message
     */
    get type(): IfPartial<IsPartial, MessageType>;
    /**
     * Get the author of the message
     */
    get author(): IfPartial<IsPartial, User | null>;
    /**
     * Get the thread associated with this message, if there is one
     */
    get thread(): IfPartial<IsPartial, GuildThreadChannel<ChannelType.PublicThread | ChannelType.AnnouncementThread> | null>;
    /**
     * Fetch updated data for this message.
     * If the message is partial, this will fetch all the data for the message and populate the fields.
     * If the message is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial Message
     */
    fetch(): Promise<Message<false>>;
    /**
     * Delete this message from Discord
     */
    delete(): Promise<void>;
    /**
     * Get the channel the message was sent in
     */
    fetchChannel(): Promise<import("./DmChannel.js").DmChannel<false> | import("./GroupDmChannel.js").GroupDmChannel<false> | import("./GuildTextChannel.js").GuildTextChannel<false> | import("./GuildStageOrVoiceChannel.js").GuildVoiceChannel<false> | import("./GuildCategoryChannel.js").GuildCategoryChannel<false> | import("./GuildAnnouncementChannel.js").GuildAnnouncementChannel<false> | GuildThreadChannel<ChannelType.AnnouncementThread | ChannelType.PublicThread | ChannelType.PrivateThread, false> | import("./GuildStageOrVoiceChannel.js").GuildStageChannel<false> | import("./GuildForumChannel.js").GuildForumChannel<false> | import("./GuildMediaChannel.js").GuildMediaChannel | null>;
    /**
     * Pin this message
     */
    pin(): Promise<void>;
    /**
     * Unpin this message
     */
    unpin(): Promise<void>;
    /**
     * Start a thread with this message as the associated start message.
     * If you want to start a thread without a start message, use {@link BaseGuildTextChannel.startThread}
     */
    startThread(data: RESTPostAPIChannelThreadsJSONBody): Promise<GuildThreadChannel<import("discord-api-types/v10").ThreadChannelType, false>>;
    /**
     * Edit this message
     * @param data - The data to edit the message with
     * @returns A Promise that resolves to the edited message
     */
    edit(data: MessagePayload): Promise<Message>;
    /**
     * Forward this message to a different channel
     * @param channelId - The ID of the channel to forward the message to
     * @returns A Promise that resolves to the forwarded message
     */
    forward(channelId: string): Promise<Message>;
    /**
     * Reply to this message
     * @param data - The data to reply with
     * @returns A Promise that resolves to the replied message
     */
    reply(data: MessagePayload): Promise<Message>;
    /**
     * Disable all buttons on the message except for link buttons
     */
    disableAllButtons(): Promise<void>;
}
//# sourceMappingURL=Message.d.ts.map