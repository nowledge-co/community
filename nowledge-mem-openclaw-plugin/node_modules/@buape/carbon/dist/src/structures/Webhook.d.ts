import type { APIMessage, APIUser, APIWebhook, RESTPatchAPIWebhookJSONBody, WebhookType } from "discord-api-types/v10";
import { RequestClient } from "../classes/RequestClient.js";
import type { IfPartial, MessagePayload } from "../types/index.js";
import { type CDNUrlOptions } from "../utils/index.js";
export type WebhookInput = APIWebhook | {
    id: string;
    token: string;
    threadId?: string;
} | string;
export declare class Webhook<IsPartial extends boolean = false> {
    rest: RequestClient;
    constructor(rawData: APIWebhook);
    constructor(idAndToken: {
        id: string;
        token: string;
        threadId?: string;
    });
    constructor(url: string);
    constructor(input: WebhookInput);
    protected _rawData: APIWebhook | null;
    private setData;
    /**
     * The raw Discord API data for this webhook
     */
    get rawData(): Readonly<APIWebhook>;
    /**
     * The ID of the webhook
     */
    readonly id: string;
    /**
     * The token of the webhook
     */
    readonly token?: string;
    /**
     * The thread ID this webhook is for
     */
    readonly threadId?: string;
    /**
     * Whether the webhook is a partial webhook (meaning it does not have all the data).
     * If this is true, you should use {@link Webhook.fetch} to get the full data of the webhook.
     */
    get partial(): IsPartial;
    /**
     * The type of the webhook
     * @see https://discord.com/developers/docs/resources/webhook#webhook-object-webhook-types
     */
    get type(): IfPartial<IsPartial, WebhookType>;
    /**
     * The guild id this webhook is for
     */
    get guildId(): IfPartial<IsPartial, string | undefined>;
    /**
     * The channel id this webhook is for
     */
    get channelId(): IfPartial<IsPartial, string>;
    /**
     * The user this webhook was created by
     * Not returned when getting a webhook with its token
     */
    get user(): IfPartial<IsPartial, APIUser | undefined>;
    /**
     * The default name of the webhook
     */
    get name(): IfPartial<IsPartial, string | null>;
    /**
     * The default avatar of the webhook
     */
    get avatar(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the webhook's avatar with default settings (png format)
     */
    get avatarUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the webhook's avatar with custom format and size options
     * @param options Optional format and size parameters
     * @returns The avatar URL or null if no avatar is set
     */
    getAvatarUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * The bot/OAuth2 application that created this webhook
     */
    get applicationId(): IfPartial<IsPartial, string | null>;
    /**
     * The guild of the channel that this webhook is following
     * Only returned for Channel Follower Webhooks
     */
    get sourceGuild(): IfPartial<IsPartial, APIWebhook["source_guild"] | undefined>;
    /**
     * The channel that this webhook is following
     * Only returned for Channel Follower Webhooks
     */
    get sourceChannel(): IfPartial<IsPartial, APIWebhook["source_channel"] | undefined>;
    /**
     * The url used for executing the webhook
     * Only returned by the webhooks OAuth2 flow
     */
    get url(): string;
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
    withComponents }: {
        wait?: boolean;
        threadId?: string;
        withComponents?: boolean;
    }): string;
    /**
     * Fetch this webhook's data
     * @returns A Promise that resolves to a non-partial Webhook
     */
    fetch(): Promise<Webhook<false>>;
    /**
     * Modify this webhook
     * @param data The data to modify the webhook with
     * @returns A Promise that resolves to the modified webhook
     */
    modify(data: RESTPatchAPIWebhookJSONBody): Promise<Webhook<false>>;
    /**
     * Delete this webhook
     * @returns A Promise that resolves when the webhook is deleted
     */
    delete(): Promise<void>;
    /**
     * Send a message through this webhook
     * @param data The data to send with the webhook
     * @param threadId Optional ID of the thread to send the message to. If not provided, uses the webhook's thread ID.
     */
    send<T extends true | false = false>(data: MessagePayload, threadId?: string, wait?: T): Promise<T extends true ? APIMessage : void>;
    /**
     * Edit a message sent by this webhook
     * @param messageId The ID of the message to edit
     * @param data The data to edit the message with
     * @param threadId Optional ID of the thread to edit the message in. If not provided, uses the webhook's thread ID.
     */
    edit(messageId: string, data: MessagePayload, threadId?: string): Promise<APIMessage>;
    /**
     * Delete a message sent by this webhook
     * @param messageId The ID of the message to delete
     * @param threadId Optional ID of the thread to delete the message from. If not provided, uses the webhook's thread ID.
     * @returns A Promise that resolves when the message is deleted
     */
    deleteMessage(messageId: string, threadId?: string): Promise<void>;
    /**
     * Get a message sent by this webhook
     * @param messageId The ID of the message to get
     * @param threadId Optional ID of the thread to get the message from. If not provided, uses the webhook's thread ID.
     * @returns The raw data of the message, which you can then use to create a Message instance
     */
    getMessage(messageId: string, threadId?: string): Promise<APIMessage>;
}
//# sourceMappingURL=Webhook.d.ts.map