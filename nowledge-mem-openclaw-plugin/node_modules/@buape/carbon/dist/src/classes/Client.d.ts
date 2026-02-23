import { type APIApplicationCommand, type APIInteraction } from "discord-api-types/v10";
import type { BaseCommand } from "../abstracts/BaseCommand.js";
import type { BaseListener } from "../abstracts/BaseListener.js";
import type { BaseMessageInteractiveComponent } from "../abstracts/BaseMessageInteractiveComponent.js";
import type { Context, Plugin, Route } from "../abstracts/Plugin.js";
import { CommandHandler } from "../internals/CommandHandler.js";
import { ComponentHandler } from "../internals/ComponentHandler.js";
import { EmojiHandler } from "../internals/EmojiHandler.js";
import { EventHandler } from "../internals/EventHandler.js";
import type { EventQueueOptions } from "../internals/EventQueue.js";
import { ModalHandler } from "../internals/ModalHandler.js";
import { TemporaryListenerManager } from "../internals/TemporaryListenerManager.js";
import { Guild } from "../structures/Guild.js";
import { GuildMember } from "../structures/GuildMember.js";
import { Message } from "../structures/Message.js";
import { Role } from "../structures/Role.js";
import { User } from "../structures/User.js";
import { Webhook, type WebhookInput } from "../structures/Webhook.js";
import type { Modal } from "./Modal.js";
import { RequestClient, type RequestClientOptions } from "./RequestClient.js";
/**
 * The options used for initializing the client
 */
export interface ClientOptions {
    /**
     * The base URL of the app
     */
    baseUrl: string;
    /**
     * The client ID of the app
     */
    clientId: string;
    /**
     * The deploy secret of the app, used for protecting the deploy route
     */
    deploySecret?: string;
    /**
     * The public key of the app, used for interaction verification
     * Can be a single key or an array of keys
     */
    publicKey: string | string[];
    /**
     * The token of the bot
     */
    token: string;
    /**
     * The options used to initialize the request client, if you want to customize it.
     */
    requestOptions?: RequestClientOptions;
    /**
     * Whether the commands should be deployed to Discord automatically.
     * @default false
     */
    autoDeploy?: boolean;
    /**
     * Whether the deploy route should be disabled.
     * @default false
     */
    disableDeployRoute?: boolean;
    /**
     * Whether the interactions route should be disabled
     * @default false
     */
    disableInteractionsRoute?: boolean;
    /**
     * Whether the events route should be disabled
     * @default false
     */
    disableEventsRoute?: boolean;
    /**
     * A list of guild IDs to deploy all commands to during development (guild command deployment is instant and rate-limited higher).
     * If set, all commands will be deployed to these guilds instead of globally.
     */
    devGuilds?: string[];
    /**
     * Configuration for the event queue worker pool
     */
    eventQueue?: EventQueueOptions;
}
/**
 * The main client used to interact with Discord
 */
export declare class Client {
    /**
     * The routes that the client will handle
     */
    routes: Route[];
    /**
     * The plugins that the client has registered
     */
    plugins: {
        id: string;
        plugin: Plugin;
    }[];
    /**
     * The options used to initialize the client
     */
    options: ClientOptions;
    /**
     * The commands that the client has registered
     */
    commands: BaseCommand[];
    /**
     * The event listeners that the client has registered
     */
    listeners: BaseListener[];
    /**
     * The rest client used to interact with the Discord API
     */
    rest: RequestClient;
    /**
     * The handler for the component interactions sent from Discord
     * @internal
     */
    componentHandler: ComponentHandler;
    /**
     * The handler for the modal interactions sent from Discord
     * @internal
     */
    commandHandler: CommandHandler;
    /**
     * The handler for the modal interactions sent from Discord
     * @internal
     */
    modalHandler: ModalHandler;
    /**
     * The handler for events sent from Discord
     * @internal
     */
    eventHandler: EventHandler;
    /**
     * The manager for temporary event listeners with automatic cleanup
     */
    temporaryListeners: TemporaryListenerManager;
    /**
     * The handler for application emojis for this application
     */
    emoji: EmojiHandler;
    private cachedGlobalCommands;
    /**
     * The ID of the shard this client is running on, if sharding is enabled
     */
    shardId?: number;
    /**
     * The total number of shards, if sharding is enabled
     */
    totalShards?: number;
    /**
     * Creates a new client
     * @param options The options used to initialize the client
     * @param handlers The handlers that the client has registered
     * @param plugins The plugins that the client should use
     */
    constructor(options: ClientOptions, handlers: {
        commands?: BaseCommand[];
        listeners?: BaseListener[];
        components?: BaseMessageInteractiveComponent[];
        modals?: Modal[];
    }, plugins?: Plugin[]);
    getPlugin<T extends Plugin>(id: string): T | undefined;
    private appendRoutes;
    /**
     * Handle a request to deploy the commands to Discord
     * @returns A response
     */
    handleDeployRequest(): Promise<Response>;
    /**
     * Handle an interaction request from Discord
     * @param req The request to handle
     * @returns A response
     */
    handleEventsRequest(req: Request): Promise<Response>;
    /**
     * Handle an interaction request from Discord
     * @param req The request to handle
     * @param ctx The context for the request
     * @returns A response
     */
    handleInteractionsRequest(req: Request, ctx: Context): Promise<Response>;
    /**
     * Handle an interaction request from Discord
     * @param interaction The interaction to handle
     * @param ctx The context for the request
     * @returns A response
     */
    handleInteraction(interaction: APIInteraction, ctx: Context): Promise<void>;
    /**
     * Validate a request from Discord
     * @param req The request to validate
     */
    protected validateDiscordRequest(req: Request): Promise<boolean>;
    /**
     * Register an event listener with the client.
     * This method provides type-safe listener registration without requiring
     * manual type casting at the call site.
     * @param listener The listener to register
     */
    registerListener<T extends BaseListener>(listener: T): void;
    /**
     * Fetch a user from the Discord API
     * @param id The ID of the user to fetch
     * @returns The user data
     */
    fetchUser(id: string): Promise<User<false>>;
    /**
     * Fetch a guild from the Discord API
     * @param id The ID of the guild to fetch
     * @returns The guild data
     */
    fetchGuild(id: string): Promise<Guild<false>>;
    /**
     * Fetch a channel from the Discord API
     * @param id The ID of the channel to fetch
     * @returns The channel data
     */
    fetchChannel(id: string): Promise<import("../index.js").DmChannel<false> | import("../index.js").GroupDmChannel<false> | import("../index.js").GuildTextChannel<false> | import("../index.js").GuildVoiceChannel<false> | import("../index.js").GuildCategoryChannel<false> | import("../index.js").GuildAnnouncementChannel<false> | import("../index.js").GuildThreadChannel<import("discord-api-types/v10").ChannelType.AnnouncementThread | import("discord-api-types/v10").ChannelType.PublicThread | import("discord-api-types/v10").ChannelType.PrivateThread, false> | import("../index.js").GuildStageChannel<false> | import("../index.js").GuildForumChannel<false> | import("../index.js").GuildMediaChannel | null>;
    /**
     * Fetch a role from the Discord API
     * @param guildId The ID of the guild the role is in
     * @param id The ID of the role to fetch
     * @returns The role data
     */
    fetchRole(guildId: string, id: string): Promise<Role<false>>;
    /**
     * Fetch a member from the Discord API
     * @param guildId The ID of the guild the member is in
     * @param id The ID of the member to fetch
     * @returns The member data
     */
    fetchMember(guildId: string, id: string): Promise<GuildMember<false, true>>;
    /**
     * Fetch a message from the Discord API
     * @param channelId The ID of the channel the message is in
     * @param messageId The ID of the message to fetch
     * @returns The message data
     */
    fetchMessage(channelId: string, messageId: string): Promise<Message<false>>;
    /**
     * Fetch a webhook from the Discord API
     * @param input The webhook data, ID and token, or webhook URL
     * @returns The webhook data
     */
    fetchWebhook(input: WebhookInput): Promise<Webhook<false>>;
    getDiscordCommands(force?: boolean): Promise<APIApplicationCommand[]>;
    private updateCommandIdsFromDeployment;
}
/**
 * @hidden
 */
export interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
}
//# sourceMappingURL=Client.d.ts.map