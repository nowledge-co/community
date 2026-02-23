"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = exports.BotError = exports.DEFAULT_UPDATE_TYPES = void 0;
// deno-lint-ignore-file camelcase
const composer_js_1 = require("./composer.js");
Object.defineProperty(exports, "BotError", { enumerable: true, get: function () { return composer_js_1.BotError; } });
const context_js_1 = require("./context.js");
const api_js_1 = require("./core/api.js");
const error_js_1 = require("./core/error.js");
const filter_js_1 = require("./filter.js");
const platform_node_js_1 = require("./platform.node.js");
const debug = (0, platform_node_js_1.debug)("grammy:bot");
const debugWarn = (0, platform_node_js_1.debug)("grammy:warn");
const debugErr = (0, platform_node_js_1.debug)("grammy:error");
exports.DEFAULT_UPDATE_TYPES = [
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "business_connection",
    "business_message",
    "edited_business_message",
    "deleted_business_messages",
    "inline_query",
    "chosen_inline_result",
    "callback_query",
    "shipping_query",
    "pre_checkout_query",
    "purchased_paid_media",
    "poll",
    "poll_answer",
    "my_chat_member",
    "chat_join_request",
    "chat_boost",
    "removed_chat_boost",
];
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
class Bot extends composer_js_1.Composer {
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
    constructor(token, config) {
        var _a;
        super();
        this.token = token;
        this.pollingRunning = false;
        this.lastTriedUpdateId = 0;
        /** Used to log a warning if some update types are not in allowed_updates */
        this.observedUpdateTypes = new Set();
        /**
         * Holds the bot's error handler that is invoked whenever middleware throws
         * (rejects). If you set your own error handler via `bot.catch`, all that
         * happens is that this variable is assigned.
         */
        this.errorHandler = async (err) => {
            var _a, _b;
            console.error("Error in middleware while handling update", (_b = (_a = err.ctx) === null || _a === void 0 ? void 0 : _a.update) === null || _b === void 0 ? void 0 : _b.update_id, err.error);
            console.error("No error handler was set!");
            console.error("Set your own error handler with `bot.catch = ...`");
            if (this.pollingRunning) {
                console.error("Stopping bot");
                await this.stop();
            }
            throw err;
        };
        if (!token)
            throw new Error("Empty token!");
        this.me = config === null || config === void 0 ? void 0 : config.botInfo;
        this.clientConfig = config === null || config === void 0 ? void 0 : config.client;
        this.ContextConstructor = (_a = config === null || config === void 0 ? void 0 : config.ContextConstructor) !== null && _a !== void 0 ? _a : context_js_1.Context;
        this.api = new api_js_1.Api(token, this.clientConfig);
    }
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
    set botInfo(botInfo) {
        this.me = botInfo;
    }
    get botInfo() {
        if (this.me === undefined) {
            throw new Error("Bot information unavailable! Make sure to call `await bot.init()` before accessing `bot.botInfo`!");
        }
        return this.me;
    }
    /**
     * @inheritdoc
     */
    on(filter, ...middleware) {
        for (const [u] of (0, filter_js_1.parse)(filter).flatMap(filter_js_1.preprocess)) {
            this.observedUpdateTypes.add(u);
        }
        return super.on(filter, ...middleware);
    }
    /**
     * @inheritdoc
     */
    reaction(reaction, ...middleware) {
        this.observedUpdateTypes.add("message_reaction");
        return super.reaction(reaction, ...middleware);
    }
    /**
     * Checks if the bot has been initialized. A bot is initialized if the bot
     * information is set. The bot information can either be set automatically
     * by calling `bot.init`, or manually through the bot constructor. Note that
     * usually, initialization is done automatically and you do not have to care
     * about this method.
     *
     * @returns true if the bot is initialized, and false otherwise
     */
    isInited() {
        return this.me !== undefined;
    }
    /**
     * Initializes the bot, i.e. fetches information about the bot itself. This
     * method is called automatically, you usually don't have to call it
     * manually.
     *
     * @param signal Optional `AbortSignal` to cancel the initialization
     */
    async init(signal) {
        var _a;
        if (!this.isInited()) {
            debug("Initializing bot");
            (_a = this.mePromise) !== null && _a !== void 0 ? _a : (this.mePromise = withRetries(() => this.api.getMe(signal), signal));
            let me;
            try {
                me = await this.mePromise;
            }
            finally {
                this.mePromise = undefined;
            }
            if (this.me === undefined)
                this.me = me;
            else
                debug("Bot info was set by now, will not overwrite");
        }
        debug(`I am ${this.me.username}!`);
    }
    /**
     * Internal. Do not call. Handles an update batch sequentially by supplying
     * it one-by-one to the middleware. Handles middleware errors and stores the
     * last update identifier that was being tried to handle.
     *
     * @param updates An array of updates to handle
     */
    async handleUpdates(updates) {
        // handle updates sequentially (!)
        for (const update of updates) {
            this.lastTriedUpdateId = update.update_id;
            try {
                await this.handleUpdate(update);
            }
            catch (err) {
                // should always be true
                if (err instanceof composer_js_1.BotError) {
                    await this.errorHandler(err);
                }
                else {
                    console.error("FATAL: grammY unable to handle:", err);
                    throw err;
                }
            }
        }
    }
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
    async handleUpdate(update, webhookReplyEnvelope) {
        if (this.me === undefined) {
            throw new Error("Bot not initialized! Either call `await bot.init()`, \
or directly set the `botInfo` option in the `Bot` constructor to specify \
a known bot info object.");
        }
        debug(`Processing update ${update.update_id}`);
        // create API object
        const api = new api_js_1.Api(this.token, this.clientConfig, webhookReplyEnvelope);
        // configure it with the same transformers as bot.api
        const t = this.api.config.installedTransformers();
        if (t.length > 0)
            api.config.use(...t);
        // create context object
        const ctx = new this.ContextConstructor(update, api, this.me);
        try {
            // run middleware stack
            await (0, composer_js_1.run)(this.middleware(), ctx);
        }
        catch (err) {
            debugErr(`Error in middleware for update ${update.update_id}`);
            throw new composer_js_1.BotError(err, ctx);
        }
    }
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
    async start(options) {
        var _a, _b, _c;
        // Perform setup
        const setup = [];
        if (!this.isInited()) {
            setup.push(this.init((_a = this.pollingAbortController) === null || _a === void 0 ? void 0 : _a.signal));
        }
        if (this.pollingRunning) {
            await Promise.all(setup);
            debug("Simple long polling already running!");
            return;
        }
        this.pollingRunning = true;
        this.pollingAbortController = new shim_node_js_1.AbortController();
        try {
            setup.push(withRetries(async () => {
                var _a;
                await this.api.deleteWebhook({
                    drop_pending_updates: options === null || options === void 0 ? void 0 : options.drop_pending_updates,
                }, (_a = this.pollingAbortController) === null || _a === void 0 ? void 0 : _a.signal);
            }, (_b = this.pollingAbortController) === null || _b === void 0 ? void 0 : _b.signal));
            await Promise.all(setup);
            // All async ops of setup complete, run callback
            await ((_c = options === null || options === void 0 ? void 0 : options.onStart) === null || _c === void 0 ? void 0 : _c.call(options, this.botInfo));
        }
        catch (err) {
            this.pollingRunning = false;
            this.pollingAbortController = undefined;
            throw err;
        }
        // Bot was stopped during `onStart`
        if (!this.pollingRunning)
            return;
        // Prevent common misuse that leads to missing updates
        validateAllowedUpdates(this.observedUpdateTypes, options === null || options === void 0 ? void 0 : options.allowed_updates);
        // Prevent common misuse that causes memory leak
        this.use = noUseFunction;
        // Start polling
        debug("Starting simple long polling");
        await this.loop(options);
        debug("Middleware is done running");
    }
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
    async stop() {
        var _a;
        if (this.pollingRunning) {
            debug("Stopping bot, saving update offset");
            this.pollingRunning = false;
            (_a = this.pollingAbortController) === null || _a === void 0 ? void 0 : _a.abort();
            const offset = this.lastTriedUpdateId + 1;
            await this.api.getUpdates({ offset, limit: 1 })
                .finally(() => this.pollingAbortController = undefined);
        }
        else {
            debug("Bot is not running!");
        }
    }
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
    isRunning() {
        return this.pollingRunning;
    }
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
    catch(errorHandler) {
        this.errorHandler = errorHandler;
    }
    /**
     * Internal. Do not call. Enters a loop that will perform long polling until
     * the bot is stopped.
     */
    async loop(options) {
        var _a, _b;
        const limit = options === null || options === void 0 ? void 0 : options.limit;
        const timeout = (_a = options === null || options === void 0 ? void 0 : options.timeout) !== null && _a !== void 0 ? _a : 30; // seconds
        let allowed_updates = (_b = options === null || options === void 0 ? void 0 : options.allowed_updates) !== null && _b !== void 0 ? _b : []; // reset to default if unspecified
        try {
            while (this.pollingRunning) {
                // fetch updates
                const updates = await this.fetchUpdates({ limit, timeout, allowed_updates });
                // check if polling stopped
                if (updates === undefined)
                    break;
                // handle updates
                await this.handleUpdates(updates);
                // Telegram uses the last setting if `allowed_updates` is omitted so
                // we can save some traffic by only sending it in the first request
                allowed_updates = undefined;
            }
        }
        finally {
            this.pollingRunning = false;
        }
    }
    /**
     * Internal. Do not call. Reliably fetches an update batch via `getUpdates`.
     * Handles all known errors. Returns `undefined` if the bot is stopped and
     * the call gets cancelled.
     *
     * @param options Polling options
     * @returns An array of updates, or `undefined` if the bot is stopped.
     */
    async fetchUpdates({ limit, timeout, allowed_updates }) {
        var _a;
        const offset = this.lastTriedUpdateId + 1;
        let updates = undefined;
        do {
            try {
                updates = await this.api.getUpdates({ offset, limit, timeout, allowed_updates }, (_a = this.pollingAbortController) === null || _a === void 0 ? void 0 : _a.signal);
            }
            catch (error) {
                await this.handlePollingError(error);
            }
        } while (updates === undefined && this.pollingRunning);
        return updates;
    }
    /**
     * Internal. Do not call. Handles an error that occurred during long
     * polling.
     */
    async handlePollingError(error) {
        var _a;
        if (!this.pollingRunning) {
            debug("Pending getUpdates request cancelled");
            return;
        }
        let sleepSeconds = 3;
        if (error instanceof error_js_1.GrammyError) {
            debugErr(error.message);
            // rethrow upon unauthorized or conflict
            if (error.error_code === 401 || error.error_code === 409) {
                throw error;
            }
            else if (error.error_code === 429) {
                debugErr("Bot API server is closing.");
                sleepSeconds = (_a = error.parameters.retry_after) !== null && _a !== void 0 ? _a : sleepSeconds;
            }
        }
        else
            debugErr(error);
        debugErr(`Call to getUpdates failed, retrying in ${sleepSeconds} seconds ...`);
        await sleep(sleepSeconds);
    }
}
exports.Bot = Bot;
/**
 * Performs a network call task, retrying upon known errors until success.
 *
 * If the task errors and a retry_after value can be used, a subsequent retry
 * will be delayed by the specified period of time.
 *
 * Otherwise, if the first attempt at running the task fails, the task is
 * retried immediately. If second attempt fails, too, waits for 100 ms, and then
 * doubles this delay for every subsequent attempt. Never waits longer than 1
 * hour before retrying.
 *
 * @param task Async task to perform
 * @param signal Optional `AbortSignal` to prevent further retries
 */
async function withRetries(task, signal) {
    // Set up delays between retries
    const INITIAL_DELAY = 50; // ms
    let lastDelay = INITIAL_DELAY;
    // Define error handler
    /**
     * Determines the error handling strategy based on various error types.
     * Sleeps if necessary, and returns whether to retry or rethrow an error.
     */
    async function handleError(error) {
        let delay = false;
        let strategy = "rethrow";
        if (error instanceof error_js_1.HttpError) {
            delay = true;
            strategy = "retry";
        }
        else if (error instanceof error_js_1.GrammyError) {
            if (error.error_code >= 500) {
                delay = true;
                strategy = "retry";
            }
            else if (error.error_code === 429) {
                const retryAfter = error.parameters.retry_after;
                if (typeof retryAfter === "number") {
                    // ignore the backoff for sleep, then reset it
                    await sleep(retryAfter, signal);
                    lastDelay = INITIAL_DELAY;
                }
                else {
                    delay = true;
                }
                strategy = "retry";
            }
        }
        if (delay) {
            // Do not sleep for the first retry
            if (lastDelay !== INITIAL_DELAY) {
                await sleep(lastDelay, signal);
            }
            const TWENTY_MINUTES = 20 * 60 * 1000; // ms
            lastDelay = Math.min(TWENTY_MINUTES, 2 * lastDelay);
        }
        return strategy;
    }
    // Perform the actual task with retries
    let result = { ok: false };
    while (!result.ok) {
        try {
            result = { ok: true, value: await task() };
        }
        catch (error) {
            debugErr(error);
            const strategy = await handleError(error);
            switch (strategy) {
                case "retry":
                    continue;
                case "rethrow":
                    throw error;
            }
        }
    }
    return result.value;
}
/**
 * Returns a new promise that resolves after the specified number of seconds, or
 * rejects as soon as the given signal is aborted.
 */
async function sleep(seconds, signal) {
    let handle;
    let reject;
    function abort() {
        reject === null || reject === void 0 ? void 0 : reject(new Error("Aborted delay"));
        if (handle !== undefined)
            clearTimeout(handle);
    }
    try {
        await new Promise((res, rej) => {
            reject = rej;
            if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                abort();
                return;
            }
            signal === null || signal === void 0 ? void 0 : signal.addEventListener("abort", abort);
            handle = setTimeout(res, 1000 * seconds);
        });
    }
    finally {
        signal === null || signal === void 0 ? void 0 : signal.removeEventListener("abort", abort);
    }
}
/**
 * Takes a set of observed update types and a list of allowed updates and logs a
 * warning in debug mode if some update types were observed that have not been
 * allowed.
 */
function validateAllowedUpdates(updates, allowed = exports.DEFAULT_UPDATE_TYPES) {
    const impossible = Array.from(updates).filter((u) => !allowed.includes(u));
    if (impossible.length > 0) {
        debugWarn(`You registered listeners for the following update types, \
but you did not specify them in \`allowed_updates\` \
so they may not be received: ${impossible.map((u) => `'${u}'`).join(", ")}`);
    }
}
function noUseFunction() {
    throw new Error(`It looks like you are registering more listeners \
on your bot from within other listeners! This means that every time your bot \
handles a message like this one, new listeners will be added. This list grows until \
your machine crashes, so grammY throws this error to tell you that you should \
probably do things a bit differently. If you're unsure how to resolve this problem, \
you can ask in the group chat: https://telegram.me/grammyjs

On the other hand, if you actually know what you're doing and you do need to install \
further middleware while your bot is running, consider installing a composer \
instance on your bot, and in turn augment the composer after the fact. This way, \
you can circumvent this protection against memory leaks.`);
}
const shim_node_js_1 = require("./shim.node.js");
