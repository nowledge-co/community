import { Routes } from "discord-api-types/v10";
import { RequestClient } from "../classes/RequestClient.js";
import { buildCDNUrl, serializePayload } from "../utils/index.js";
export class Webhook {
    rest;
    constructor(input) {
        if (!input)
            throw new Error(`Missing input, currently set to ${input}`);
        if (typeof input === "string") {
            const url = new URL(input);
            if (url.protocol !== "https:")
                throw new Error("Invalid URL");
            const [id, token] = url.pathname.split("/").slice(3);
            if (!id || !token)
                throw new Error("Invalid URL");
            this.id = id;
            this.token = token;
            const potentialThreadId = url.searchParams.get("thread_id");
            this.threadId = potentialThreadId ?? undefined;
        }
        else {
            if ("channel_id" in input) {
                this.setData(input);
            }
            this.id = input.id;
            this.token = input.token;
            this.threadId = "threadId" in input ? input.threadId : undefined;
        }
        this.rest = new RequestClient("webhook");
    }
    _rawData = null;
    setData(data) {
        if (!data)
            throw new Error("Cannot set data without having data... smh");
        this._rawData = data;
    }
    /**
     * The raw Discord API data for this webhook
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial Webhook. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The ID of the webhook
     */
    id;
    /**
     * The token of the webhook
     */
    token;
    /**
     * The thread ID this webhook is for
     */
    threadId;
    /**
     * Whether the webhook is a partial webhook (meaning it does not have all the data).
     * If this is true, you should use {@link Webhook.fetch} to get the full data of the webhook.
     */
    get partial() {
        return (this._rawData === null);
    }
    /**
     * The type of the webhook
     * @see https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types
     */
    get type() {
        if (!this._rawData)
            return undefined;
        return this._rawData.type;
    }
    /**
     * The guild id this webhook is for
     */
    get guildId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.guild_id;
    }
    /**
     * The channel id this webhook is for
     */
    get channelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.channel_id;
    }
    /**
     * The user this webhook was created by
     * Not returned when getting a webhook with its token
     */
    get user() {
        if (!this._rawData?.user)
            return undefined;
        return this._rawData.user;
    }
    /**
     * The default name of the webhook
     */
    get name() {
        if (!this._rawData)
            return undefined;
        return this._rawData.name;
    }
    /**
     * The default avatar of the webhook
     */
    get avatar() {
        if (!this._rawData)
            return undefined;
        return this._rawData.avatar;
    }
    /**
     * Get the URL of the webhook's avatar with default settings (png format)
     */
    get avatarUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/avatars/${this.id}`, this.avatar);
    }
    /**
     * Get the URL of the webhook's avatar with custom format and size options
     * @param options Optional format and size parameters
     * @returns The avatar URL or null if no avatar is set
     */
    getAvatarUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/avatars/${this.id}`, this.avatar, options);
    }
    /**
     * The bot/OAuth2 application that created this webhook
     */
    get applicationId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.application_id;
    }
    /**
     * The guild of the channel that this webhook is following
     * Only returned for Channel Follower Webhooks
     */
    get sourceGuild() {
        if (!this._rawData)
            return undefined;
        return this._rawData.source_guild;
    }
    /**
     * The channel that this webhook is following
     * Only returned for Channel Follower Webhooks
     */
    get sourceChannel() {
        if (!this._rawData)
            return undefined;
        return this._rawData.source_channel;
    }
    /**
     * The url used for executing the webhook
     * Only returned by the webhooks OAuth2 flow
     */
    get url() {
        const base = `https://discord.com/api/webhooks/${this.id}/${this.token}`;
        const queryParams = new URLSearchParams();
        if (this.threadId)
            queryParams.set("thread_id", this.threadId);
        return base;
    }
    urlWithOptions({ 
    /**
     * Waits for server confirmation of message send before response, and returns the created message body
     */
    wait, 
    /**
     * Specify the thread to use with this webhook
     */
    threadId, 
    /**
     * Whether to respect the components field of the request. When enabled, allows application-owned webhooks to use all components and non-owned webhooks to use non-interactive components
     * @default false
     */
    withComponents }) {
        let base = `/webhooks/${this.id}/${this.token}`;
        const queryParams = new URLSearchParams();
        if (this.threadId)
            queryParams.set("thread_id", this.threadId);
        if (threadId)
            queryParams.set("thread_id", threadId);
        if (wait)
            queryParams.set("wait", "true");
        if (withComponents)
            queryParams.set("with_components", "true");
        if (queryParams.size > 0)
            base += `?${queryParams.toString()}`;
        return base;
    }
    /**
     * Fetch this webhook's data
     * @returns A Promise that resolves to a non-partial Webhook
     */
    async fetch() {
        const newData = (await this.rest.get(Routes.webhook(this.id)));
        if (!newData)
            throw new Error(`Webhook ${this.id} not found`);
        this.setData(newData);
        return this;
    }
    /**
     * Modify this webhook
     * @param data The data to modify the webhook with
     * @returns A Promise that resolves to the modified webhook
     */
    async modify(data) {
        const newData = (await this.rest.patch(Routes.webhook(this.id), {
            body: data
        }));
        this.setData(newData);
        return this;
    }
    /**
     * Delete this webhook
     * @returns A Promise that resolves when the webhook is deleted
     */
    async delete() {
        await this.rest.delete(Routes.webhook(this.id));
    }
    /**
     * Send a message through this webhook
     * @param data The data to send with the webhook
     * @param threadId Optional ID of the thread to send the message to. If not provided, uses the webhook's thread ID.
     */
    async send(data, threadId, wait) {
        if (!this.token)
            throw new Error("Cannot send webhook message without token");
        const serialized = serializePayload(data);
        const finalThreadId = threadId || this.threadId;
        const response = (await this.rest.post(this.urlWithOptions({ wait, threadId }), {
            body: serialized
        }, finalThreadId ? { thread_id: finalThreadId } : undefined));
        return response;
    }
    /**
     * Edit a message sent by this webhook
     * @param messageId The ID of the message to edit
     * @param data The data to edit the message with
     * @param threadId Optional ID of the thread to edit the message in. If not provided, uses the webhook's thread ID.
     */
    async edit(messageId, data, threadId) {
        if (!this.token)
            throw new Error("Cannot edit webhook message without token");
        const serialized = serializePayload(data);
        const finalThreadId = threadId || this.threadId;
        const message = (await this.rest.patch(Routes.webhookMessage(this.id, this.token, messageId) +
            (threadId ? `?thread_id=${threadId}` : ""), {
            body: serialized
        }, finalThreadId ? { thread_id: finalThreadId } : undefined));
        return message;
    }
    /**
     * Delete a message sent by this webhook
     * @param messageId The ID of the message to delete
     * @param threadId Optional ID of the thread to delete the message from. If not provided, uses the webhook's thread ID.
     * @returns A Promise that resolves when the message is deleted
     */
    async deleteMessage(messageId, threadId) {
        if (!this.token)
            throw new Error("Cannot delete webhook message without token");
        const finalThreadId = threadId || this.threadId;
        await this.rest.delete(Routes.webhookMessage(this.id, this.token, messageId) +
            (threadId ? `?thread_id=${threadId}` : ""), undefined, finalThreadId ? { thread_id: finalThreadId } : undefined);
    }
    /**
     * Get a message sent by this webhook
     * @param messageId The ID of the message to get
     * @param threadId Optional ID of the thread to get the message from. If not provided, uses the webhook's thread ID.
     * @returns The raw data of the message, which you can then use to create a Message instance
     */
    async getMessage(messageId, threadId) {
        if (!this.token)
            throw new Error("Cannot get webhook message without token");
        const finalThreadId = threadId || this.threadId;
        const message = (await this.rest.get(Routes.webhookMessage(this.id, this.token, messageId) +
            (threadId ? `?thread_id=${threadId}` : ""), finalThreadId ? { thread_id: finalThreadId } : undefined));
        return message;
    }
}
//# sourceMappingURL=Webhook.js.map