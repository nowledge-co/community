"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Composer = exports.BotError = void 0;
exports.run = run;
const context_js_1 = require("./context.js");
// === Middleware errors
/**
 * This error is thrown when middleware throws. It simply wraps the original
 * error (accessible via the `error` property), but also provides access to the
 * respective context object that was processed while the error occurred.
 */
class BotError extends Error {
    constructor(error, ctx) {
        super(generateBotErrorMessage(error));
        this.error = error;
        this.ctx = ctx;
        this.name = "BotError";
        if (error instanceof Error)
            this.stack = error.stack;
    }
}
exports.BotError = BotError;
function generateBotErrorMessage(error) {
    let msg;
    if (error instanceof Error) {
        msg = `${error.name} in middleware: ${error.message}`;
    }
    else {
        const type = typeof error;
        msg = `Non-error value of type ${type} thrown in middleware`;
        switch (type) {
            case "bigint":
            case "boolean":
            case "number":
            case "symbol":
                msg += `: ${error}`;
                break;
            case "string":
                msg += `: ${String(error).substring(0, 50)}`;
                break;
            default:
                msg += "!";
                break;
        }
    }
    return msg;
}
// === Middleware base functions
function flatten(mw) {
    return typeof mw === "function"
        ? mw
        : (ctx, next) => mw.middleware()(ctx, next);
}
function concat(first, andThen) {
    return async (ctx, next) => {
        let nextCalled = false;
        await first(ctx, async () => {
            if (nextCalled)
                throw new Error("`next` already called before!");
            else
                nextCalled = true;
            await andThen(ctx, next);
        });
    };
}
function pass(_ctx, next) {
    return next();
}
const leaf = () => Promise.resolve();
/**
 * Runs some given middleware function with a given context object.
 *
 * @param middleware The middleware to run
 * @param ctx The context to use
 */
async function run(middleware, ctx) {
    await middleware(ctx, leaf);
}
// === Composer
/**
 * The composer is the heart of the middleware system in grammY. It is also the
 * superclass of `Bot`. Whenever you call `use` or `on` or some of the other
 * methods on your bot, you are in fact using the underlying composer instance
 * to register your middleware.
 *
 * If you're just getting started, you do not need to worry about what
 * middleware is, or about how to use a composer.
 *
 * On the other hand, if you want to dig deeper into how grammY implements
 * middleware, check out the
 * [documentation](https://grammy.dev/advanced/middleware) on the website.
 */
class Composer {
    /**
     * Constructs a new composer based on the provided middleware. If no
     * middleware is given, the composer instance will simply make all context
     * objects pass through without touching them.
     *
     * @param middleware The middleware to compose
     */
    constructor(...middleware) {
        this.handler = middleware.length === 0
            ? pass
            : middleware.map(flatten).reduce(concat);
    }
    middleware() {
        return this.handler;
    }
    /**
     * Registers some middleware that receives all updates. It is installed by
     * concatenating it to the end of all previously installed middleware.
     *
     * Often, this method is used to install middleware that behaves like a
     * plugin, for example session middleware.
     * ```ts
     * bot.use(session())
     * ```
     *
     * This method returns a new instance of composer. The returned instance can
     * be further extended, and all changes will be regarded here. Confer the
     * [documentation](https://grammy.dev/advanced/middleware) on the
     * website if you want to know more about how the middleware system in
     * grammY works, especially when it comes to chaining the method calls
     * (`use( ... ).use( ... ).use( ... )`).
     *
     * @param middleware The middleware to register
     */
    use(...middleware) {
        const composer = new Composer(...middleware);
        this.handler = concat(this.handler, flatten(composer));
        return composer;
    }
    /**
     * Registers some middleware that will only be executed for some specific
     * updates, namely those matching the provided filter query. Filter queries
     * are a concise way to specify which updates you are interested in.
     *
     * Here are some examples of valid filter queries:
     * ```ts
     * // All kinds of message updates
     * bot.on('message', ctx => { ... })
     *
     * // Only text messages
     * bot.on('message:text', ctx => { ... })
     *
     * // Only text messages with URL
     * bot.on('message:entities:url', ctx => { ... })
     *
     * // Text messages and text channel posts
     * bot.on(':text', ctx => { ... })
     *
     * // Messages with URL in text or caption (i.e. entities or caption entities)
     * bot.on('message::url', ctx => { ... })
     *
     * // Messages or channel posts with URL in text or caption
     * bot.on('::url', ctx => { ... })
     * ```
     *
     * You can use autocomplete in VS Code to see all available filter queries.
     * Check out the
     * [documentation](https://grammy.dev/guide/filter-queries) on the
     * website to learn more about filter queries in grammY.
     *
     * It is possible to pass multiple filter queries in an array, i.e.
     * ```ts
     * // Matches all text messages and edited text messages that contain a URL
     * bot.on(['message:entities:url', 'edited_message:entities:url'], ctx => { ... })
     * ```
     *
     * Your middleware will be executed if _any of the provided filter queries_
     * matches (logical OR).
     *
     * If you instead want to match _all of the provided filter queries_
     * (logical AND), you can chain the `.on` calls:
     * ```ts
     * // Matches all messages and channel posts that both a) contain a URL and b) are forwards
     * bot.on('::url').on(':forward_origin', ctx => { ... })
     * ```
     *
     * @param filter The filter query to use, may also be an array of queries
     * @param middleware The middleware to register behind the given filter
     */
    on(filter, ...middleware) {
        return this.filter(context_js_1.Context.has.filterQuery(filter), ...middleware);
    }
    /**
     * Registers some middleware that will only be executed when the message
     * contains some text. Is it possible to pass a regular expression to match:
     * ```ts
     * // Match some text (exact match)
     * bot.hears('I love grammY', ctx => ctx.reply('And grammY loves you! <3'))
     * // Match a regular expression
     * bot.hears(/\/echo (.+)/, ctx => ctx.reply(ctx.match[1]))
     * ```
     * Note how `ctx.match` will contain the result of the regular expression.
     * Here it is a `RegExpMatchArray` object, so `ctx.match[1]` refers to the
     * part of the regex that was matched by `(.+)`, i.e. the text that comes
     * after “/echo”.
     *
     * You can pass an array of triggers. Your middleware will be executed if at
     * least one of them matches.
     *
     * Both text and captions of the received messages will be scanned. For
     * example, when a photo is sent to the chat and its caption matches the
     * trigger, your middleware will be executed.
     *
     * If you only want to match text messages and not captions, you can do
     * this:
     * ```ts
     * // Only matches text messages (and channel posts) for the regex
     * bot.on(':text').hears(/\/echo (.+)/, ctx => { ... })
     * ```
     *
     * @param trigger The text to look for
     * @param middleware The middleware to register
     */
    hears(trigger, ...middleware) {
        return this.filter(context_js_1.Context.has.text(trigger), ...middleware);
    }
    /**
     * Registers some middleware that will only be executed when a certain
     * command is found.
     * ```ts
     * // Reacts to /start commands
     * bot.command('start', ctx => { ... })
     * // Reacts to /help commands
     * bot.command('help', ctx => { ... })
     * ```
     *
     * The rest of the message (excluding the command, and trimmed) is provided
     * via `ctx.match`.
     *
     * > **Did you know?** You can use deep linking
     * > (https://core.telegram.org/bots/features#deep-linking) to let users
     * > start your bot with a custom payload. As an example, send someone the
     * > link https://t.me/name-of-your-bot?start=custom-payload and register a
     * > start command handler on your bot with grammY. As soon as the user
     * > starts your bot, you will receive `custom-payload` in the `ctx.match`
     * > property!
     * > ```ts
     * > bot.command('start', ctx => {
     * >   const payload = ctx.match // will be 'custom-payload'
     * > })
     * > ```
     *
     * Note that commands are not matched in captions or in the middle of the
     * text.
     * ```ts
     * bot.command('start', ctx => { ... })
     * // ... does not match:
     * // A message saying: “some text /start some more text”
     * // A photo message with the caption “/start”
     * ```
     *
     * By default, commands are detected in channel posts, too. This means that
     * `ctx.message` is potentially `undefined`, so you should use `ctx.msg`
     * instead to grab both messages and channel posts. Alternatively, if you
     * want to limit your bot to finding commands only in private and group
     * chats, you can use `bot.on('message').command('start', ctx => { ... })`,
     * or even store a message-only version of your bot in a variable like so:
     * ```ts
     * const m = bot.on('message')
     *
     * m.command('start', ctx => { ... })
     * m.command('help', ctx => { ... })
     * // etc
     * ```
     *
     * If you need more freedom matching your commands, check out the `commands`
     * plugin.
     *
     * @param command The command to look for
     * @param middleware The middleware to register
     */
    command(command, ...middleware) {
        return this.filter(context_js_1.Context.has.command(command), ...middleware);
    }
    /**
     * Registers some middleware that will only be added when a new reaction of
     * the given type is added to a message.
     * ```ts
     * // Reacts to new '👍' reactions
     * bot.reaction('👍', ctx => { ... })
     * // Reacts to new '👍' or '👎' reactions
     * bot.reaction(['👍', '👎'], ctx => { ... })
     * ```
     *
     * > Note that you have to enable `message_reaction` updates in
     * `allowed_updates` if you want your bot to receive updates about message
     * reactions.
     *
     * `bot.reaction` will trigger if:
     * - a new emoji reaction is added to a message
     * - a new custom emoji reaction is added a message
     *
     * `bot.reaction` will not trigger if:
     * - a reaction is removed
     * - an anonymous reaction count is updated, such as on channel posts
     * - `message_reaction` updates are not enabled for your bot
     *
     * @param reaction The reaction to look for
     * @param middleware The middleware to register
     */
    reaction(reaction, ...middleware) {
        return this.filter(context_js_1.Context.has.reaction(reaction), ...middleware);
    }
    /**
     * Registers some middleware for certain chat types only. For example, you
     * can use this method to only receive updates from private chats. The four
     * chat types are `"channel"`, `"supergroup"`, `"group"`, and `"private"`.
     * This is especially useful when combined with other filtering logic. For
     * example, this is how can you respond to `/start` commands only from
     * private chats:
     * ```ts
     * bot.chatType("private").command("start", ctx => { ... })
     * ```
     *
     * Naturally, you can also use this method on its own.
     * ```ts
     * // Private chats only
     * bot.chatType("private", ctx => { ... });
     * // Channels only
     * bot.chatType("channel", ctx => { ... });
     * ```
     *
     * You can pass an array of chat types if you want your middleware to run
     * for any of several provided chat types.
     * ```ts
     * // Groups and supergroups only
     * bot.chatType(["group", "supergroup"], ctx => { ... });
     * ```
     * [Remember](https://grammy.dev/guide/context#shortcuts) also that you
     * can access the chat type via `ctx.chat.type`.
     *
     * @param chatType The chat type
     * @param middleware The middleware to register
     */
    chatType(chatType, ...middleware) {
        return this.filter(context_js_1.Context.has.chatType(chatType), ...middleware);
    }
    /**
     * Registers some middleware for callback queries, i.e. the updates that
     * Telegram delivers to your bot when a user clicks an inline button (that
     * is a button under a message).
     *
     * This method is essentially the same as calling
     * ```ts
     * bot.on('callback_query:data', ctx => { ... })
     * ```
     * but it also allows you to match the query data against a given text or
     * regular expression.
     *
     * ```ts
     * // Create an inline keyboard
     * const keyboard = new InlineKeyboard().text('Go!', 'button-payload')
     * // Send a message with the keyboard
     * await bot.api.sendMessage(chat_id, 'Press a button!', {
     *   reply_markup: keyboard
     * })
     * // Listen to users pressing buttons with that specific payload
     * bot.callbackQuery('button-payload', ctx => { ... })
     *
     * // Listen to users pressing any button your bot ever sent
     * bot.on('callback_query:data', ctx => { ... })
     * ```
     *
     * Always remember to call `answerCallbackQuery`—even if you don't perform
     * any action: https://core.telegram.org/bots/api#answercallbackquery
     * ```ts
     * bot.on('callback_query:data', async ctx => {
     *   await ctx.answerCallbackQuery()
     * })
     * ```
     *
     * You can pass an array of triggers. Your middleware will be executed if at
     * least one of them matches.
     *
     * @param trigger The string to look for in the payload
     * @param middleware The middleware to register
     */
    callbackQuery(trigger, ...middleware) {
        return this.filter(context_js_1.Context.has.callbackQuery(trigger), ...middleware);
    }
    /**
     * Registers some middleware for game queries, i.e. the updates that
     * Telegram delivers to your bot when a user clicks an inline button for the
     * HTML5 games platform on Telegram.
     *
     * This method is essentially the same as calling
     * ```ts
     * bot.on('callback_query:game_short_name', ctx => { ... })
     * ```
     * but it also allows you to match the query data against a given text or
     * regular expression.
     *
     * You can pass an array of triggers. Your middleware will be executed if at
     * least one of them matches.
     *
     * @param trigger The string to look for in the payload
     * @param middleware The middleware to register
     */
    gameQuery(trigger, ...middleware) {
        return this.filter(context_js_1.Context.has.gameQuery(trigger), ...middleware);
    }
    /**
     * Registers middleware for inline queries. Telegram sends an inline query
     * to your bot whenever a user types “@your_bot_name ...” into a text field
     * in Telegram. You bot will then receive the entered search query and can
     * respond with a number of results (text, images, etc) that the user can
     * pick from to send a message _via_ your bot to the respective chat. Check
     * out https://core.telegram.org/bots/inline to read more about inline bots.
     *
     * > Note that you have to enable inline mode for you bot by contacting
     * > @BotFather first.
     *
     * ```ts
     * // Listen for users typing “@your_bot_name query”
     * bot.inlineQuery('query', async ctx => {
     *   // Answer the inline query, confer https://core.telegram.org/bots/api#answerinlinequery
     *   await ctx.answerInlineQuery( ... )
     * })
     * ```
     *
     * @param trigger The inline query text to match
     * @param middleware The middleware to register
     */
    inlineQuery(trigger, ...middleware) {
        return this.filter(context_js_1.Context.has.inlineQuery(trigger), ...middleware);
    }
    /**
     * Registers middleware for the ChosenInlineResult by the given id or ids.
     * ChosenInlineResult represents a result of an inline query that was chosen
     * by the user and sent to their chat partner. Check out
     * https://core.telegram.org/bots/api#choseninlineresult to read more about
     * chosen inline results.
     *
     * ```ts
     * bot.chosenInlineResult('id', async ctx => {
     *   const id = ctx.result_id;
     *   // Your code
     * })
     * ```
     *
     * @param resultId An id or array of ids
     * @param middleware The middleware to register
     */
    chosenInlineResult(resultId, ...middleware) {
        return this.filter(context_js_1.Context.has.chosenInlineResult(resultId), ...middleware);
    }
    /**
     * Registers middleware for pre-checkout queries. Telegram sends a
     * pre-checkout query to your bot whenever a user has confirmed their
     * payment and shipping details. You bot will then receive all information
     * about the order and has to respond within 10 seconds with a confirmation
     * of whether everything is alright (goods are available, etc.) and the bot
     * is ready to proceed with the order. Check out
     * https://core.telegram.org/bots/api#precheckoutquery to read more about
     * pre-checkout queries.
     *
     * ```ts
     * bot.preCheckoutQuery('invoice_payload', async ctx => {
     *   // Answer the pre-checkout query, confer https://core.telegram.org/bots/api#answerprecheckoutquery
     *   await ctx.answerPreCheckoutQuery( ... )
     * })
     * ```
     *
     * @param trigger The string to look for in the invoice payload
     * @param middleware The middleware to register
     */
    preCheckoutQuery(trigger, ...middleware) {
        return this.filter(context_js_1.Context.has.preCheckoutQuery(trigger), ...middleware);
    }
    /**
     * Registers middleware for shipping queries. If you sent an invoice
     * requesting a shipping address and the parameter _is_flexible_ was
     * specified, Telegram will send a shipping query to your bot whenever a
     * user has confirmed their shipping details. You bot will then receive the
     * shipping information and can respond with a confirmation of whether
     * delivery to the specified address is possible. Check out
     * https://core.telegram.org/bots/api#shippingquery to read more about
     * shipping queries.
     *
     * ```ts
     * bot.shippingQuery('invoice_payload', async ctx => {
     *   // Answer the shipping query, confer https://core.telegram.org/bots/api#answershippingquery
     *   await ctx.answerShippingQuery( ... )
     * })
     * ```
     *
     * @param trigger The string to look for in the invoice payload
     * @param middleware The middleware to register
     */
    shippingQuery(trigger, ...middleware) {
        return this.filter(context_js_1.Context.has.shippingQuery(trigger), ...middleware);
    }
    filter(predicate, ...middleware) {
        const composer = new Composer(...middleware);
        this.branch(predicate, composer, pass);
        return composer;
    }
    /**
     * > This is an advanced method of grammY.
     *
     * Registers middleware behind a custom filter function that operates on the
     * context object and decides whether or not to execute the middleware. In
     * other words, the middleware will only be executed if the given predicate
     * returns `false` for the given context object. Otherwise, it will be
     * skipped and the next middleware will be executed. Note that the predicate
     * may be asynchronous, i.e. it can return a Promise of a boolean.
     *
     * This method is the same using `filter` (normal usage) with a negated
     * predicate.
     *
     * @param predicate The predicate to check
     * @param middleware The middleware to register
     */
    drop(predicate, ...middleware) {
        return this.filter(async (ctx) => !(await predicate(ctx)), ...middleware);
    }
    /**
     * > This is an advanced method of grammY.
     *
     * Registers some middleware that runs concurrently to the executing
     * middleware stack.
     * ```ts
     * bot.use( ... ) // will run first
     * bot.fork( ... ) // will be started second, but run concurrently
     * bot.use( ... ) // will also be run second
     * ```
     * In the first middleware, as soon as `next`'s Promise resolves, both forks
     * have completed.
     *
     * Both the fork and the downstream middleware are awaited with
     * `Promise.all`, so you will only be able to catch at most one error (the
     * one that is thrown first).
     *
     * In contrast to the other middleware methods on composer, `fork` does not
     * simply return the composer connected to the main middleware stack.
     * Instead, it returns the created composer _of the fork_ connected to the
     * middleware stack. This allows for the following pattern.
     * ```ts
     * // Middleware will be run concurrently!
     * bot.fork().on('message', ctx => { ... })
     * ```
     *
     * @param middleware The middleware to run concurrently
     */
    fork(...middleware) {
        const composer = new Composer(...middleware);
        const fork = flatten(composer);
        this.use((ctx, next) => Promise.all([next(), run(fork, ctx)]));
        return composer;
    }
    /**
     * > This is an advanced method of grammY.
     *
     * Executes some middleware that can be generated on the fly for each
     * context. Pass a factory function that creates some middleware (or a
     * middleware array even). The factory function will be called once per
     * context, and its result will be executed with the context object.
     * ```ts
     * // The middleware returned by `createMyMiddleware` will be used only once
     * bot.lazy(ctx => createMyMiddleware(ctx))
     * ```
     *
     * You may generate this middleware in an `async` fashion.
     *
     * You can decide to return an empty array (`[]`) if you don't want to run
     * any middleware for a given context object. This is equivalent to
     * returning an empty instance of `Composer`.
     *
     * @param middlewareFactory The factory function creating the middleware
     */
    lazy(middlewareFactory) {
        return this.use(async (ctx, next) => {
            const middleware = await middlewareFactory(ctx);
            const arr = Array.isArray(middleware) ? middleware : [middleware];
            await flatten(new Composer(...arr))(ctx, next);
        });
    }
    /**
     * > This is an advanced method of grammY.
     *
     * _Not to be confused with the `router` plugin._
     *
     * This method is an alternative to the `router` plugin. It allows you to
     * branch between different middleware per context object. You can pass two
     * things to it:
     * 1. A routing function
     * 2. Different middleware identified by key
     *
     * The routing function decides based on the context object which middleware
     * to run. Each middleware is identified by a key, so the routing function
     * simply returns the key of that middleware.
     * ```ts
     * // Define different route handlers
     * const routeHandlers = {
     *   evenUpdates: (ctx: Context) => { ... }
     *   oddUpdates: (ctx: Context) => { ... }
     * }
     * // Decide for a context object which one to pick
     * const router = (ctx: Context) => ctx.update.update_id % 2 === 0
     *   ? 'evenUpdates'
     *   : 'oddUpdates'
     * // Route it!
     * bot.route(router, routeHandlers)
     * ```
     *
     * Optionally, you can pass a third option that is used as fallback
     * middleware if your route function returns `undefined`, or if the key
     * returned by your router has no middleware associated with it.
     *
     * This method may need less setup than first instantiating a `Router`, but
     * for more complex setups, having a `Router` may be more readable.
     *
     * @param router The routing function to use
     * @param routeHandlers Handlers for every route
     * @param fallback Optional fallback middleware if no route matches
     */
    route(router, routeHandlers, fallback = pass) {
        return this.lazy(async (ctx) => {
            var _a;
            const route = await router(ctx);
            return (_a = (route === undefined || !routeHandlers[route]
                ? fallback
                : routeHandlers[route])) !== null && _a !== void 0 ? _a : [];
        });
    }
    /**
     * > This is an advanced method of grammY.
     *
     * Allows you to branch between two cases for a given context object.
     *
     * This method takes a predicate function that is tested once per context
     * object. If it returns `true`, the first supplied middleware is executed.
     * If it returns `false`, the second supplied middleware is executed. Note
     * that the predicate may be asynchronous, i.e. it can return a Promise of a
     * boolean.
     *
     * @param predicate The predicate to check
     * @param trueMiddleware The middleware for the `true` case
     * @param falseMiddleware The middleware for the `false` case
     */
    branch(predicate, trueMiddleware, falseMiddleware) {
        return this.lazy(async (ctx) => (await predicate(ctx)) ? trueMiddleware : falseMiddleware);
    }
    /**
     * > This is an advanced function of grammY.
     *
     * Installs an error boundary that catches errors that happen only inside
     * the given middleware. This allows you to install custom error handlers
     * that protect some parts of your bot. Errors will not be able to bubble
     * out of this part of your middleware system, unless the supplied error
     * handler rethrows them, in which case the next surrounding error boundary
     * will catch the error.
     *
     * Example usage:
     * ```ts
     * function errHandler(err: BotError) {
     *   console.error('Error boundary caught error!', err)
     * }
     *
     * const safe =
     *   // All passed middleware will be protected by the error boundary.
     *   bot.errorBoundary(errHandler, middleware0, middleware1, middleware2)
     *
     * // Those will also be protected!
     * safe.on('message', middleware3)
     *
     * // No error from `middleware4` will reach the `errHandler` from above,
     * // as errors are suppressed.
     *
     * // do nothing on error (suppress error), and run outside middleware
     * const suppress = (_err: BotError, next: NextFunction) => { return next() }
     * safe.errorBoundary(suppress).on('edited_message', middleware4)
     * ```
     *
     * Check out the
     * [documentation](https://grammy.dev/guide/errors#error-boundaries) on
     * the website to learn more about error boundaries.
     *
     * @param errorHandler The error handler to use
     * @param middleware The middleware to protect
     */
    errorBoundary(errorHandler, ...middleware) {
        const composer = new Composer(...middleware);
        const bound = flatten(composer);
        this.use(async (ctx, next) => {
            let nextCalled = false;
            const cont = () => ((nextCalled = true), Promise.resolve());
            try {
                await bound(ctx, cont);
            }
            catch (err) {
                nextCalled = false;
                await errorHandler(new BotError(err, ctx), cont);
            }
            if (nextCalled)
                await next();
        });
        return composer;
    }
}
exports.Composer = Composer;
