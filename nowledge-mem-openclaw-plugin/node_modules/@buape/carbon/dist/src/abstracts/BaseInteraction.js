import { InteractionResponseType, MessageFlags, Routes } from "discord-api-types/v10";
import { BaseMessageInteractiveComponent, Container, channelFactory, Embed, Guild, Message, Row, Section, User } from "../index.js";
import { GuildMember } from "../structures/GuildMember.js";
import { serializePayload } from "../utils/index.js";
import { Base } from "./Base.js";
/**
 * This is the base type interaction, all interaction types extend from this
 */
export class BaseInteraction extends Base {
    /**
     * The type of interaction
     */
    type;
    /**
     * The internal raw data of the interaction
     */
    _rawData;
    /**
     * The raw Discord API data for this interaction
     */
    get rawData() {
        return this._rawData;
    }
    /**
     * The user who sent the interaction
     */
    userId;
    /**
     * Whether the interaction is deferred already
     * @internal
     */
    _deferred = false;
    defaultEphemeral = false;
    constructor(client, data, defaults) {
        super(client);
        this._rawData = data;
        this.type = data.type;
        this.userId =
            this._rawData.user?.id || this._rawData.member?.user.id || undefined;
        if (defaults.ephemeral)
            this.defaultEphemeral = defaults.ephemeral;
    }
    get embeds() {
        if (!this._rawData.message)
            return null;
        return this._rawData.message.embeds.map((embed) => new Embed(embed));
    }
    get message() {
        if (!this._rawData.message)
            return null;
        return new Message(this.client, this._rawData.message);
    }
    get guild() {
        if (!this._rawData.guild_id)
            return null;
        return new Guild(this.client, this._rawData.guild_id);
    }
    get user() {
        if (this._rawData.user)
            return new User(this.client, this._rawData.user);
        if (this._rawData.member)
            return new User(this.client, this._rawData.member.user);
        return null;
    }
    get channel() {
        if (!this._rawData.channel)
            return null;
        return channelFactory(this.client, this._rawData.channel);
    }
    get member() {
        if (!this._rawData.member)
            return null;
        if (!this.guild)
            return null;
        return new GuildMember(this.client, this._rawData.member, this.guild);
    }
    /**
     * @internal
     * Automatically register components found in a message payload when sending the message.
     */
    _internalAutoRegisterComponentsOnSend(data) {
        if (typeof data !== "string" && data.components) {
            this._internalRegisterComponentsOnSend(data.components);
        }
    }
    /**
     * @internal
     * Register components found in a message payload when sending the message.
     */
    _internalRegisterComponentsOnSend(components) {
        for (const component of components) {
            if (component instanceof Row) {
                for (const childComponent of component.components) {
                    if (childComponent instanceof BaseMessageInteractiveComponent) {
                        const key = childComponent.customIdParser(childComponent.customId).key;
                        if (!this.client.componentHandler.hasComponentWithKey(key, childComponent.type)) {
                            this.client.componentHandler.registerComponent(childComponent);
                        }
                    }
                }
            }
            else if (component instanceof Section) {
                if (component.accessory instanceof BaseMessageInteractiveComponent) {
                    const key = component.accessory.customIdParser(component.accessory.customId).key;
                    if (!this.client.componentHandler.hasComponentWithKey(key, component.accessory.type)) {
                        this.client.componentHandler.registerComponent(component.accessory);
                    }
                }
            }
            else if (component instanceof Container) {
                this._internalRegisterComponentsOnSend(component.components);
            }
        }
    }
    /**
     * Reply to an interaction.
     * If the interaction is deferred, this will edit the original response.
     * @param data The message data to send
     */
    async reply(data, overrideAutoRegister = false) {
        const serialized = serializePayload(data, this.defaultEphemeral);
        // Auto-register any components in the message
        if (!overrideAutoRegister)
            this._internalAutoRegisterComponentsOnSend(data);
        if (this._deferred) {
            const message = (await this.client.rest.patch(Routes.webhookMessage(this.client.options.clientId, this._rawData.token, "@original"), {
                body: serialized
            }));
            return new Message(this.client, message);
        }
        const done = (await this.client.rest.post(Routes.interactionCallback(this._rawData.id, this._rawData.token), {
            body: {
                type: InteractionResponseType.ChannelMessageWithSource,
                data: serialized
            }
        }, {
            with_response: true
        }));
        if (!done.resource?.message)
            throw new Error(`No resource returned for message from interaction callback: ${done.resource}`);
        return new Message(this.client, done.resource.message);
    }
    /**
     * Set the default ephemeral value for this interaction
     * @internal
     */
    setDefaultEphemeral(ephemeral) {
        this.defaultEphemeral = ephemeral;
    }
    /**
     * Defer the interaction response. This is used automatically by commands that are set to defer.
     * If the interaction is already deferred, this will do nothing.
     * @internal
     */
    async defer({ ephemeral = false } = {}) {
        if (this._deferred)
            return;
        this._deferred = true;
        await this.client.rest.post(Routes.interactionCallback(this._rawData.id, this._rawData.token), {
            body: {
                type: InteractionResponseType.DeferredChannelMessageWithSource,
                data: {
                    flags: ephemeral || this.defaultEphemeral
                        ? MessageFlags.Ephemeral
                        : undefined
                }
            }
        });
    }
    /**
     * Show a modal to the user
     * This can only be used if the interaction is not deferred
     */
    async showModal(modal) {
        if (this._deferred)
            throw new Error("You cannot defer an interaction that shows a modal");
        const key = modal.customIdParser(modal.customId).key;
        const existingModal = this.client.modalHandler.modals.find((m) => m.customIdParser(m.customId).key === key);
        if (!existingModal) {
            this.client.modalHandler.registerModal(modal);
        }
        await this.client.rest.post(Routes.interactionCallback(this._rawData.id, this._rawData.token), {
            body: {
                type: InteractionResponseType.Modal,
                data: modal.serialize()
            }
        });
    }
    /**
     * Send a followup message to the interaction
     */
    async followUp(reply) {
        const serialized = serializePayload(reply);
        // Auto-register any components in the message
        this._internalAutoRegisterComponentsOnSend(reply);
        await this.client.rest.post(Routes.webhook(this.client.options.clientId, this._rawData.token), {
            body: {
                ...serialized
            }
        });
    }
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
    async replyAndWaitForComponent(data, timeout = 300000) {
        const message = await this.reply(data, true);
        const id = `${message.id}-${message.channelId}`;
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.client.componentHandler.oneOffComponents.delete(id);
                resolve({ success: false, message, reason: "timed out" });
            }, timeout);
            this.client.componentHandler.oneOffComponents.set(id, {
                resolve: (data) => {
                    clearTimeout(timer);
                    this.client.componentHandler.oneOffComponents.delete(id);
                    resolve({
                        success: true,
                        customId: data.custom_id,
                        message,
                        values: "values" in data ? data.values : undefined
                    });
                }
            });
        });
    }
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
    async editAndWaitForComponent(data, message, timeout = 300000) {
        const editedMessage = message
            ? await message.edit(data)
            : await this.message?.edit(data);
        if (!editedMessage)
            return null;
        const id = `${editedMessage.id}-${editedMessage.channelId}`;
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                this.client.componentHandler.oneOffComponents.delete(id);
                resolve({ success: false, message: editedMessage, reason: "timed out" });
            }, timeout);
            this.client.componentHandler.oneOffComponents.set(id, {
                resolve: (data) => {
                    clearTimeout(timer);
                    this.client.componentHandler.oneOffComponents.delete(id);
                    resolve({
                        success: true,
                        customId: data.custom_id,
                        message: editedMessage,
                        values: "values" in data ? data.values : undefined
                    });
                }
            });
        });
    }
}
//# sourceMappingURL=BaseInteraction.js.map