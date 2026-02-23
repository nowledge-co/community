import { ComponentType, MessageReferenceType, Routes } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { Embed } from "../classes/Embed.js";
import { channelFactory } from "../functions/channelFactory.js";
import { serializePayload } from "../utils/index.js";
import { GuildThreadChannel } from "./GuildThreadChannel.js";
import { Poll } from "./Poll.js";
import { Role } from "./Role.js";
import { User } from "./User.js";
export class Message extends Base {
    constructor(client, rawDataOrIds) {
        super(client);
        if (Object.keys(rawDataOrIds).length === 2 &&
            "id" in rawDataOrIds &&
            "channelId" in rawDataOrIds) {
            this.id = rawDataOrIds.id;
            this.channelId = rawDataOrIds.channelId || "";
        }
        else {
            const data = rawDataOrIds;
            this.id = data.id;
            this.channelId = data.channel_id;
            this.setData(data);
        }
    }
    _rawData = null;
    setData(data) {
        this._rawData = data;
        if (!data)
            throw new Error("Cannot set data without having data... smh");
    }
    /**
     * The raw Discord API data for this message
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial Message. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The ID of the message
     */
    id;
    /**
     * The ID of the channel the message is in
     */
    channelId;
    /**
     * Whether the message is a partial message (meaning it does not have all the data).
     * If this is true, you should use {@link Message.fetch} to get the full data of the message.
     */
    get partial() {
        return (this._rawData === null);
    }
    /**
     * If this message is a response to an interaction, this is the ID of the interaction's application
     */
    get applicationId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.application_id;
    }
    /**
     * The attachments of the message
     */
    get attachments() {
        if (!this._rawData)
            return undefined;
        return this._rawData.attachments ?? [];
    }
    /**
     * The components of the message
     */
    get components() {
        if (!this._rawData)
            return undefined;
        return this._rawData.components ?? [];
    }
    /**
     * The content of the message
     */
    get content() {
        if (!this._rawData)
            return undefined;
        return this._rawData.content ?? "";
    }
    get embeds() {
        if (!this._rawData)
            return undefined;
        if (!this._rawData?.embeds)
            return [];
        return this._rawData.embeds.map((embed) => new Embed(embed));
    }
    /**
     * If this message was edited, this is the timestamp of the edit
     */
    get editedTimestamp() {
        if (!this._rawData)
            return undefined;
        return this._rawData.edited_timestamp;
    }
    /**
     * The flags of the message
     */
    get flags() {
        if (!this._rawData)
            return undefined;
        return this._rawData.flags;
    }
    /**
     * The interaction metadata of the message
     */
    get interactionMetadata() {
        if (!this._rawData)
            return undefined;
        return this._rawData.interaction_metadata;
    }
    /**
     * Whether the message mentions everyone
     */
    get mentionedEveryone() {
        if (!this._rawData)
            return undefined;
        return this._rawData.mention_everyone;
    }
    /**
     * The users mentioned in the message
     */
    get mentionedUsers() {
        if (!this._rawData)
            return undefined;
        if (!this._rawData?.mentions)
            return [];
        return this._rawData.mentions.map((mention) => new User(this.client, mention));
    }
    /**
     * The roles mentioned in the message
     */
    get mentionedRoles() {
        if (!this._rawData)
            return undefined;
        if (!this._rawData?.mention_roles)
            return [];
        return this._rawData.mention_roles.map((mention) => new Role(this.client, mention));
    }
    /**
     * The data about the referenced message. You can use {@link Message.referencedMessage} to get the referenced message itself.
     */
    get messageReference() {
        if (!this._rawData)
            return undefined;
        return this._rawData.message_reference;
    }
    /**
     * The referenced message itself
     */
    get referencedMessage() {
        if (!this._rawData?.referenced_message)
            return null;
        return new Message(this.client, this._rawData?.referenced_message);
    }
    /**
     * Whether the message is pinned
     */
    get pinned() {
        if (!this._rawData)
            return undefined;
        return this._rawData.pinned;
    }
    /**
     * The poll contained in the message
     */
    get poll() {
        if (!this._rawData?.poll)
            return undefined;
        return new Poll(this.client, {
            channelId: this.channelId,
            messageId: this.id,
            data: this._rawData.poll
        });
    }
    /**
     * The approximate position of the message in the channel
     */
    get position() {
        if (!this._rawData)
            return undefined;
        return this._rawData.position;
    }
    /**
     * The reactions on the message
     */
    get reactions() {
        if (!this._rawData)
            return undefined;
        return this._rawData.reactions ?? [];
    }
    /**
     * The stickers in the message
     */
    get stickers() {
        if (!this._rawData)
            return undefined;
        return this._rawData.sticker_items ?? [];
    }
    /**
     * The timestamp of the original message
     */
    get timestamp() {
        if (!this._rawData)
            return undefined;
        return this._rawData.timestamp;
    }
    /**
     * Whether the message is a TTS message
     */
    get tts() {
        if (!this._rawData)
            return undefined;
        return this._rawData.tts;
    }
    /**
     * The type of the message
     */
    get type() {
        if (!this._rawData)
            return undefined;
        return this._rawData.type;
    }
    /**
     * Get the author of the message
     */
    get author() {
        if (!this._rawData)
            return null;
        if (this._rawData?.webhook_id)
            return null; // TODO: Add webhook user
        return new User(this.client, this._rawData.author);
    }
    /**
     * Get the thread associated with this message, if there is one
     */
    get thread() {
        if (!this.rawData)
            return null;
        if (!this._rawData?.thread)
            return null;
        return channelFactory(this.client, this._rawData?.thread);
    }
    /**
     * Fetch updated data for this message.
     * If the message is partial, this will fetch all the data for the message and populate the fields.
     * If the message is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial Message
     */
    async fetch() {
        if (!this.channelId)
            throw new Error("Cannot fetch message without channel ID");
        const newData = (await this.client.rest.get(Routes.channelMessage(this.channelId, this.id)));
        if (!newData)
            throw new Error(`Message ${this.id} not found`);
        this.setData(newData);
        return this;
    }
    /**
     * Delete this message from Discord
     */
    async delete() {
        if (!this.channelId)
            throw new Error("Cannot delete message without channel ID");
        await this.client.rest.delete(Routes.channelMessage(this.channelId, this.id));
    }
    /**
     * Get the channel the message was sent in
     */
    async fetchChannel() {
        if (!this.channelId)
            throw new Error("Cannot fetch channel without channel ID");
        const data = (await this.client.rest.get(Routes.channel(this.channelId)));
        const channel = channelFactory(this.client, data);
        return channel;
    }
    /**
     * Pin this message
     */
    async pin() {
        if (!this.channelId)
            throw new Error("Cannot pin message without channel ID");
        await this.client.rest.put(Routes.channelMessagesPin(this.channelId, this.id));
    }
    /**
     * Unpin this message
     */
    async unpin() {
        if (!this.channelId)
            throw new Error("Cannot unpin message without channel ID");
        await this.client.rest.delete(Routes.channelMessagesPin(this.channelId, this.id));
    }
    /**
     * Start a thread with this message as the associated start message.
     * If you want to start a thread without a start message, use {@link BaseGuildTextChannel.startThread}
     */
    async startThread(data) {
        if (!this.channelId)
            throw new Error("Cannot start thread without channel ID");
        const thread = (await this.client.rest.post(Routes.threads(this.channelId, this.id), {
            body: { ...data }
        }));
        return new GuildThreadChannel(this.client, thread);
    }
    /**
     * Edit this message
     * @param data - The data to edit the message with
     * @returns A Promise that resolves to the edited message
     */
    async edit(data) {
        if (!this.channelId)
            throw new Error("Cannot edit message without channel ID");
        const serialized = serializePayload(data);
        const newMessage = (await this.client.rest.patch(Routes.channelMessage(this.channelId, this.id), {
            body: {
                ...serialized
            }
        }));
        this.setData(newMessage);
        return this;
    }
    /**
     * Forward this message to a different channel
     * @param channelId - The ID of the channel to forward the message to
     * @returns A Promise that resolves to the forwarded message
     */
    async forward(channelId) {
        if (!this.channelId)
            throw new Error("Cannot forward message without channel ID");
        const channel = await this.client.fetchChannel(channelId);
        if (!channel)
            throw new Error(`Channel ${channelId} not found`);
        if (!("send" in channel))
            throw new Error(`Cannot forward message to channel ${channelId}`);
        const message = (await this.client.rest.post(Routes.channelMessages(channelId), {
            body: {
                message_reference: {
                    type: MessageReferenceType.Forward,
                    message_id: this.id,
                    channel_id: this.channelId
                }
            }
        }));
        return new Message(this.client, message);
    }
    /**
     * Reply to this message
     * @param data - The data to reply with
     * @returns A Promise that resolves to the replied message
     */
    async reply(data) {
        if (!this.channelId)
            throw new Error("Cannot reply to message without channel ID");
        const serialized = serializePayload(data);
        const message = (await this.client.rest.post(Routes.channelMessages(this.channelId), {
            body: {
                ...serialized,
                message_reference: {
                    type: MessageReferenceType.Default,
                    message_id: this.id
                }
            }
        }));
        return new Message(this.client, message);
    }
    /**
     * Disable all buttons on the message except for link buttons
     */
    async disableAllButtons() {
        if (!this._rawData)
            return;
        if (!this._rawData.components)
            return;
        const patched = (await this.client.rest.patch(Routes.channelMessage(this.channelId, this.id), {
            body: {
                ...this._rawData,
                components: this._rawData.components?.map((component) => {
                    const disable = (component) => {
                        if (component.type === ComponentType.ActionRow) {
                            return {
                                ...component,
                                components: component.components.map((c) => ({
                                    ...c,
                                    ...("disabled" in c ? { disabled: true } : {})
                                }))
                            };
                        }
                        if (component.type === ComponentType.Section) {
                            return {
                                ...component,
                                accessory: "disabled" in component.accessory
                                    ? { ...component.accessory, disabled: true }
                                    : component.accessory
                            };
                        }
                        return component;
                    };
                    if (component.type === ComponentType.Container) {
                        return {
                            ...component,
                            components: component.components.map((c) => disable(c))
                        };
                    }
                    return disable(component);
                }) ?? []
            }
        }));
        this.setData(patched);
    }
}
//# sourceMappingURL=Message.js.map