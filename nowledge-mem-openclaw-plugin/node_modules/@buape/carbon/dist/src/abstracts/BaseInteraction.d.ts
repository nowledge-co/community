import { type APIInteraction, type InteractionType } from "discord-api-types/v10";
import { type Client, Embed, Guild, Message, type Modal, User } from "../index.js";
import { GuildMember } from "../structures/GuildMember.js";
import type { MessagePayload } from "../types/index.js";
import { Base } from "./Base.js";
export type InteractionDefaults = {
    ephemeral?: boolean;
};
/**
 * This is the base type interaction, all interaction types extend from this
 */
export declare abstract class BaseInteraction<T extends APIInteraction> extends Base {
    /**
     * The type of interaction
     */
    type: InteractionType;
    /**
     * The internal raw data of the interaction
     */
    protected _rawData: T;
    /**
     * The raw Discord API data for this interaction
     */
    get rawData(): Readonly<T>;
    /**
     * The user who sent the interaction
     */
    userId: string | undefined;
    /**
     * Whether the interaction is deferred already
     * @internal
     */
    _deferred: boolean;
    private defaultEphemeral;
    constructor(client: Client, data: T, defaults: InteractionDefaults);
    get embeds(): Embed[] | null;
    get message(): Message | null;
    get guild(): Guild<true> | null;
    get user(): User | null;
    get channel(): import("../index.js").DmChannel<false> | import("../index.js").GroupDmChannel<false> | import("../index.js").GuildTextChannel<false> | import("../index.js").GuildVoiceChannel<false> | import("../index.js").GuildCategoryChannel<false> | import("../index.js").GuildAnnouncementChannel<false> | import("../index.js").GuildThreadChannel<import("discord-api-types/v10").ChannelType.AnnouncementThread | import("discord-api-types/v10").ChannelType.PublicThread | import("discord-api-types/v10").ChannelType.PrivateThread, false> | import("../index.js").GuildStageChannel<false> | import("../index.js").GuildForumChannel<false> | import("../index.js").GuildMediaChannel | null;
    get member(): GuildMember<false, true> | null;
    /**
     * @internal
     * Automatically register components found in a message payload when sending the message.
     */
    protected _internalAutoRegisterComponentsOnSend(data: MessagePayload): void;
    /**
     * @internal
     * Register components found in a message payload when sending the message.
     */
    private _internalRegisterComponentsOnSend;
    /**
     * Reply to an interaction.
     * If the interaction is deferred, this will edit the original response.
     * @param data The message data to send
     */
    reply(data: MessagePayload, overrideAutoRegister?: boolean): Promise<Message<false>>;
    /**
     * Set the default ephemeral value for this interaction
     * @internal
     */
    setDefaultEphemeral(ephemeral: boolean): void;
    /**
     * Defer the interaction response. This is used automatically by commands that are set to defer.
     * If the interaction is already deferred, this will do nothing.
     * @internal
     */
    defer({ ephemeral }?: {
        ephemeral?: boolean | undefined;
    }): Promise<void>;
    /**
     * Show a modal to the user
     * This can only be used if the interaction is not deferred
     */
    showModal(modal: Modal): Promise<void>;
    /**
     * Send a followup message to the interaction
     */
    followUp(reply: MessagePayload): Promise<void>;
    /**
     * This function will reply to the interaction and wait for a component to be pressed.
     * Any components passed in the message will not have run() functions called and
     * will only trigger the interaction.acknowledge() function.
     * This function will also return a promise that resolves
     * to the custom ID of the component that was pressed.
     *
     * @param data The message data to send
     * @param timeout After this many milliseconds, the promise will resolve to null
     */
    replyAndWaitForComponent(data: MessagePayload, timeout?: number): Promise<{
        /**
         * Whether the interaction was successful
         */
        success: true;
        /**
         * The custom ID of the component that was pressed
         */
        customId: string;
        /**
         * The message object returned by the interaction reply
         */
        message: Message<false>;
        /**
         * If this is a select menu, this will be the values of the selected options
         */
        values?: string[];
    } | {
        /**
         * Whether the interaction was successful
         */
        success: false;
        /**
         * The message object returned by the interaction reply
         */
        message: Message<false>;
        /**
         * The reason the interaction failed
         */
        reason: "timed out";
    }>;
    /**
     * This function will edit to the interaction and wait for a component to be pressed.
     * Any components passed in the message will not have run() functions called and
     * will only trigger the interaction.acknowledge() function.
     * This function will also return a promise that resolves
     * to the custom ID of the component that was pressed.
     *
     * @param data The message data to send
     * @param message The message to edit (defaults to the interaction's original message)
     * @param {number} [timeout=300000] After this many milliseconds, the promise will resolve to null
     *
     * @returns Will return null if the interaction has not yet been replied to or if the message provided no longer exists
     */
    editAndWaitForComponent(data: MessagePayload, message?: Message, timeout?: number): Promise<{
        /**
         * Whether the interaction was successful
         */
        success: true;
        /**
         * The custom ID of the component that was pressed
         */
        customId: string;
        /**
         * The message object returned by the interaction reply
         */
        message: Message<false>;
        /**
         * If this is a select menu, this will be the values of the selected options
         */
        values?: string[];
    } | {
        /**
         * Whether the interaction was successful
         */
        success: false;
        /**
         * The message object returned by the interaction reply
         */
        message: Message<false>;
        /**
         * The reason the interaction failed
         */
        reason: "timed out";
    } | null>;
}
//# sourceMappingURL=BaseInteraction.d.ts.map