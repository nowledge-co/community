import { BotError, Composer, type Middleware, type ReactionMiddleware } from "./composer.js";
import { Context, type MaybeArray, type ReactionContext } from "./context.js";
import { Api } from "./core/api.js";
import { type ApiClientOptions, type WebhookReplyEnvelope } from "./core/client.js";
import { type Filter, type FilterQuery } from "./filter.js";
import { type ReactionType, type ReactionTypeEmoji, type Update, type UserFromGetMe } from "./types.js";
export declare const DEFAULT_UPDATE_TYPES: readonly ["message", "edited_message", "channel_post", "edited_channel_post", "business_connection", "business_message", "edited_business_message", "deleted_business_messages", "inline_query", "chosen_inline_result", "callback_query", "shipping_query", "pre_checkout_query", "purchased_paid_media", "poll", "poll_answer", "my_chat_member", "chat_join_request", "chat_boost", "removed_chat_boost"];
/**
 * Options that can be specified when running the bot via simple long polling.
 */
export interface PollingOptions {
    /**
     * Limits the number of updates to be retrieved per `getUpdates` call.
     * Values between 1-100 are accepted. Defaults to 100.
     */
    limit?: number;
    /**
     * Timeout in seconds for long polling. grammY uses 30 seconds as a default
     * value.
     */
    timeout?: number;
    /**
     * A list of the update types you want your bot to receive. For example,
     * specify ["message", "edited_channel_post", "callback_query"] to only
     * receive updates of these types. See Update for a complete list of
     * available update types. Specify an empty list to receive all update types
     * except chat_member, message_reaction, and message_reaction_count
     * (default). If not specified, the previous setting will be used.
     *
     * Please note that this parameter doesn't affect updates created before the
     * call to the getUpdates, so unwanted updates may be received for a short
     * period of time.
     */
    allowed_updates?: ReadonlyArray<Exclude<keyof Update, "update_id">>;
    /**
     * Pass True to drop all pending updates before starting the long polling.
     */
    drop_pending_updates?: boolean;
    /**
     * A callback function that is useful for logging (or setting up middleware
     * if you did not do this before). It will be executed after the setup of
     * the bot has completed, and immediately before the first updates are being
     * fetched. The bot information `bot.botInfo` will be available when the
     * function is run. For convenience, the callback function receives the
     * value of `bot.botInfo` as an argument.
     *
     * When this function is invoked, the bot already signals that it is
     * running. In other words, `bot.isRunning()` already returns true.
     */
    onStart?: (botInfo: UserFromGetMe) => void | Promise<void>;
}
export { BotError };
/**
 * Error handler that can be installed on a bot to catch error thrown by
 * middleware.
 */
export type ErrorHandler<C extends Context = Context> = (error: BotError<C>) => unknown;
/**
 * Options to pass to the bot when creating it.
 */
export interface BotConfig<C extends Context> {
    /**
     * You can specify a number of advanced options under the `client` property.
     * The options will be passed to the grammY client—this is the part of
     * grammY that actually connects to the Telegram Bot API server in the end
     * when making HTTP requests.
     */
    client?: ApiClientOptions;
    /**
     * grammY automatically calls `getMe` when starting up to make sure that
     * your bot has access to the bot's own information. If you restart your bot
     * often, for example because it is running in a serverless environment,
     * then you may want to skip this initial API call.
     *
     * Set this property of the options to pre-initialize the bot with cached
     * values. If you use this option, grammY will not attempt to make a `getMe`
     * call but use the provided data instead.
     */
    botInfo?: UserFromGetMe;
    /**
     * Pass the constructor of a custom context object that will be used when
     * creating the context for each incoming update.
     */
    ContextConstructor?: new (...args: ConstructorParameters<typeof Context>) => C;
}
/**
 * This is the single most important class of grammY. It represents your bot.
 *
 * First, you must create a bot by talking to @BotFather, check out
 * https://t.me/BotFather. Once it is ready, you obtain a secret token for your
 * bot. grammY will use that token to identify as your bot when talking to the
 * Telegram servers. Got the token? You are now ready to write some code and run
 * your bot!
 *
 * You should do three things to run your bot:
 * ```ts
 * // 1. Create a bot instance
 * const bot = new Bot('<secret-token>')
 * // 2. Listen for updates
 * bot.on('message:text', ctx => ctx.reply('You wrote: ' + ctx.message.text))
 * // 3. Launch it!
 * bot.start()
 * ```
 */
export declare class Bot<C extends Context = Context, A extends Api = Api> extends Composer<C> {
    readonly token: string;
    private pollingRunning;
    private pollingAbortController;
    private lastTriedUpdateId;
    /**
     * Gives you full access to the Telegram Bot API.
     * ```ts
     * // This is how to call the Bot API methods:
     * bot.api.sendMessage(chat_id, 'Hello, grammY!')
     * ```
     *
     * Use this only outside of your middleware. If you have access to `ctx`,
     * then using `ctx.api` instead of `bot.api` is preferred.
     */
    readonly api: A;
    private me;
    private mePromise;
    private readonly clientConfig;
    private readonly ContextConstructor;
    /** Used to log a warning if some update types are not in allowed_updates */
    private observedUpdateTypes;
    /**
     * Holds the bot's error handler that is invoked whenever middleware throws
     * (rejects). If you set your own error handler via `bot.catch`, all that
     * happens is that this variable is assigned.
     */
    errorHandler: ErrorHandler<C>;
    /**
     * Creates a new Bot with the given token.
     *
     * Remember that you can listen for messages by calling
     * ```ts
     * bot.on('message', ctx => { ... })
     * ```
     * or similar methods.
     *
     * The simplest way to start your bot is via simple long polling:
     * ```ts
     * bot.start()
     * ```
     *
     * @param token The bot's token as acquired from https://t.me/BotFather
     * @param config Optional configuration properties for the bot
     */
    constructor(token: string, config?: BotConfig<C>);
    /**
     * Information about the bot itself as retrieved from `api.getMe()`. Only
     * available after the bot has been initialized via `await bot.init()`, or
     * after the value has been set manually.
     *
     * Starting the bot will always perform the initialization automatically,
     * unless a manual value is already set.
     *
     * Note that the recommended way to set a custom bot information object is
     * to pass it to the configuration object of the `new Bot()` instantiation,
     * rather than assigning this property.
     */
    set botInfo(botInfo: UserFromGetMe);
    get botInfo(): UserFromGetMe;
    /**
     * @inheritdoc
     */
    on<Q extends FilterQuery>(filter: Q | Q[], ...middleware: Array<Middleware<Filter<C, Q>>>): Composer<Filter<C, Q>>;
    /**
     * @inheritdoc
     */
    reaction(reaction: MaybeArray<ReactionTypeEmoji["emoji"] | ReactionType>, ...middleware: Array<ReactionMiddleware<C>>): Composer<ReactionContext<C>>;
    /**
     * Checks if the bot has been initialized. A bot is initialized if the bot
     * information is set. The bot information can either be set automatically
     * by calling `bot.init`, or manually through the bot constructor. Note that
     * usually, initialization is done automatically and you do not have to care
     * about this method.
     *
     * @returns true if the bot is initialized, and false otherwise
     */
    isInited(): boolean;
    /**
     * Initializes the bot, i.e. fetches information about the bot itself. This
     * method is called automatically, you usually don't have to call it
     * manually.
     *
     * @param signal Optional `AbortSignal` to cancel the initialization
     */
    init(signal?: AbortSignal): Promise<void>;
    /**
     * Internal. Do not call. Handles an update batch sequentially by supplying
     * it one-by-one to the middleware. Handles middleware errors and stores the
     * last update identifier that was being tried to handle.
     *
     * @param updates An array of updates to handle
     */
    private handleUpdates;
    /**
     * This is an internal method that you probably will not ever need to call.
     * It is used whenever a new update arrives from the Telegram servers that
     * your bot will handle.
     *
     * If you're writing a library on top of grammY, check out the
     * [documentation](https://grammy.dev/plugins/runner) of the runner
     * plugin for an example that uses this method.
     *
     * @param update An update from the Telegram Bot API
     * @param webhookReplyEnvelope An optional webhook reply envelope
     */
    handleUpdate(update: Update, webhookReplyEnvelope?: WebhookReplyEnvelope): Promise<void>;
    /**
     * Starts your bot using long polling.
     *
     * > This method returns a `Promise` that will never resolve except if your
     * > bot is stopped. **You don't need to `await` the call to `bot.start`**,
     * > but remember to catch potential errors by calling `bot.catch`.
     * > Otherwise your bot will crash (and stop) if something goes wrong in
     * > your code.
     *
     * This method effectively enters a loop that will repeatedly call
     * `getUpdates` and run your middleware for every received update, allowing
     * your bot to respond to messages.
     *
     * If your bot is already running, this method does nothing.
     *
     * **Note that this starts your bot using a very simple long polling
     * implementation.** `bot.start` should only be used for small bots. While
     * the rest of grammY was built to perform well even under extreme loads,
     * simple long polling is not capable of scaling up in a similar fashion.
     * You should switch over to using `@grammyjs/runner` if you are running a
     * bot with high load.
     *
     * What exactly _high load_ means differs from bot to bot, but as a rule of
     * thumb, simple long polling should not be processing more than ~5K
     * messages every hour. Also, if your bot has long-running operations such
     * as large file transfers that block the middleware from completing, this
     * will impact the responsiveness negatively, so it makes sense to use the
     * `@grammyjs/runner` package even if you receive much fewer messages. If
     * you worry about how much load your bot can handle, check out the grammY
     * [documentation](https://grammy.dev/advanced/scaling) about scaling
     * up.
     *
     * @param options Options to use for simple long polling
     */
    start(options?: PollingOptions): Promise<void>;
    /**
     * Stops the bot from long polling.
     *
     * All middleware that is currently being executed may complete, but no
     * further `getUpdates` calls will be performed. The current `getUpdates`
     * request will be cancelled.
     *
     * In addition, this method will _confirm_ the last received update to the
     * Telegram servers by calling `getUpdates` one last time with the latest
     * offset value. If any updates are received in this call, they are
     * discarded and will be fetched again when the bot starts up the next time.
     * Confer the official documentation on confirming updates if you want to
     * know more: https://core.telegram.org/bots/api#getupdates
     *
     * > Note that this method will not wait for the middleware stack to finish.
     * > If you need to run code after all middleware is done, consider waiting
     * > for the promise returned by `bot.start()` to resolve.
     */
    stop(): Promise<void>;
    /**
     * Returns true if the bot is currently running via built-in long polling,
     * and false otherwise.
     *
     * If this method returns true, it means that `bot.start()` has been called,
     * and that the bot has neither crashed nor was it stopped via a call to
     * `bot.stop()`. This also means that you cannot use this method to check if
     * a webhook server is running, or if grammY runner was started.
     *
     * Note that this method will already begin to return true even before the
     * call to `bot.start()` has completed its initialization phase (and hence
     * before `bot.isInited()` returns true). By extension, this method
     * returns true before `onStart` callback of `bot.start()` is invoked.
     */
    isRunning(): boolean;
    /**
     * Sets the bots error handler that is used during long polling.
     *
     * You should call this method to set an error handler if you are using long
     * polling, no matter whether you use `bot.start` or the `@grammyjs/runner`
     * package to run your bot.
     *
     * Calling `bot.catch` when using other means of running your bot (or
     * webhooks) has no effect.
     *
     * @param errorHandler A function that handles potential middleware errors
     */
    catch(errorHandler: ErrorHandler<C>): void;
    /**
     * Internal. Do not call. Enters a loop that will perform long polling until
     * the bot is stopped.
     */
    private loop;
    /**
     * Internal. Do not call. Reliably fetches an update batch via `getUpdates`.
     * Handles all known errors. Returns `undefined` if the bot is stopped and
     * the call gets cancelled.
     *
     * @param options Polling options
     * @returns An array of updates, or `undefined` if the bot is stopped.
     */
    private fetchUpdates;
    /**
     * Internal. Do not call. Handles an error that occurred during long
     * polling.
     */
    private handlePollingError;
}
import { AbortSignal } from "./shim.node.js";
