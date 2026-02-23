import { type Update } from "./deps.node.js";
import { type SinkOptions, type UpdateSink } from "./sink.js";
import { type SourceOptions, type UpdateSource } from "./source.js";
/**
 * Options to be passed to `run(bot, options)`. Collects the options for the
 * underlying update source, runner, and update sink.
 */
export interface RunOptions<Y> {
    /**
     * Options that influence the behavior of the update source.
     */
    source?: SourceOptions;
    /**
     * Options that influence the behavior of the runner which connects source and sink.
     */
    runner?: RunnerOptions;
    /**
     * Options that influence the behavior of the sink that processes the updates.
     */
    sink?: SinkOptions<Y>;
}
/**
 * Options to be passed to the runner created internally by `run(bot)`.
 */
export interface RunnerOptions {
    /**
     * Options that can be passed when fetching new updates. All options here are
     * simply forwarded to `getUpdates`. The runner itself does not do anything
     * with them.
     */
    fetch?: FetchOptions;
    /**
     * When a call to `getUpdates` fails, this option specifies the number of
     * milliseconds that the runner should keep on retrying the calls.
     */
    maxRetryTime?: number;
    /**
     * Time to wait between retries of calls to `getUpdates`. Can be a number of
     * milliseconds to wait. Can be 'exponential' or 'quadratic' for increasing
     * backoff starting at 100 milliseconds.
     */
    retryInterval?: "exponential" | "quadratic" | number;
    /**
     * The runner logs all errors from `getUpdates` calls via `console.error`.
     * Set this option to `false` to suppress output.
     */
    silent?: boolean;
}
/**
 * Options that can be passed to the call to `getUpdates` when the runner
 * fetches new a new batch of updates.
 *
 * Corresponds to the options mentioned in
 * https://core.telegram.org/bots/api#getupdates but without the parameters that
 * the runner controls.
 */
export interface FetchOptions {
    /**
     * Timeout in seconds for long polling. Defaults to 30.
     */
    timeout?: number;
    /**
     * A list of the update types you want your bot to receive. For example,
     * specify `["message", "edited_channel_post", "callback_query"]` to only
     * receive updates of these types. See
     * [Update](https://core.telegram.org/bots/api#update) for a complete list
     * of available update types. Specify an empty list to receive all update
     * types except `chat_member` (default). If not specified, the previous
     * setting will be used.
     */
    allowed_updates?: ReadonlyArray<Exclude<keyof Update, "update_id">>;
}
/**
 * This handle gives you control over a runner. It allows you to stop the bot,
 * start it again, and check whether it is running.
 */
export interface RunnerHandle {
    /**
     * Starts the bot. Note that calling `run` will automatically do this for
     * you, so you only have to call `start` if you create a runner yourself
     * with `createRunner`.
     */
    start: () => void;
    /**
     * Stops the bot. The bot will no longer fetch updates from Telegram, and it
     * will interrupt the currently pending `getUpdates` call.
     *
     * This method returns a promise that will resolve as soon as all currently
     * running middleware is done executing. This means that you can `await
     * handle.stop()` to be sure that your bot really stopped completely.
     */
    stop: () => Promise<void>;
    /**
     * Returns the size of the underlying update sink. This number is equal to
     * the number of updates that are currently being processed. The size does
     * not count updates that have completed, errored, or timed out.
     */
    size: () => number;
    /**
     * Returns a promise that resolves as soon as the runner stops, either by
     * being stopped or by crashing. If the bot crashes, it means that the error
     * handlers installed on the bot re-threw the error, in which case the bot
     * terminates. A runner handle does not give you access to errors thrown by
     * the bot. Returns `undefined` if and only if `isRunning` returns `false`.
     */
    task: () => Promise<void> | undefined;
    /**
     * Determines whether the bot is currently running or not. Note that this
     * will return `false` as soon as you call `stop` on the handle, even though
     * the promise returned by `stop` may not have resolved yet.
     */
    isRunning: () => boolean;
}
/**
 * Adapter interface that specifies a minimal structure a bot has to obey in
 * order for `run` to be able to run it. All grammY bots automatically conform
 * with this structure.
 */
interface BotAdapter<Y, R> {
    init?: () => Promise<void>;
    handleUpdate: (update: Y) => Promise<void>;
    errorHandler: (error: R) => unknown;
    api: {
        getUpdates: (args: {
            offset: number;
            limit: number;
            timeout: number;
        }, signal: AbortSignal) => Promise<Y[]>;
    };
}
/**
 * Runs a grammY bot with long polling. Updates are processed concurrently with
 * a default maximum concurrency of 500 updates. Calls to `getUpdates` will be
 * slowed down and the `limit` parameter will be adjusted as soon as this load
 * limit is reached.
 *
 * You should use this method if your bot processes a lot of updates (several
 * thousand per hour), or if your bot has long-running operations such as large
 * file transfers.
 *
 * Confer the grammY [documentation](https://grammy.dev/plugins/runner.html) to
 * learn more about how to scale a bot with grammY.
 *
 * @param bot A grammY bot
 * @param options Further configuration options
 * @returns A handle to manage your running bot
 */
export declare function run<Y extends {
    update_id: number;
}, R>(bot: BotAdapter<Y, R>, options?: RunOptions<Y>): RunnerHandle;
/**
 * Takes a grammY bot and returns an update fetcher function for it. The
 * returned function has built-in retrying behavior that can be configured.
 * After every successful fetching operation, the `offset` parameter is
 * correctly incremented. As a result, you can simply invoke the created function
 * multiple times in a row, and you will obtain new updates every time.
 *
 * The update fetcher function has a default long polling timeout of 30 seconds.
 * Specify `sourceOptions` to configure what values to pass to `getUpdates`
 * calls.
 *
 * @param bot A grammY bot
 * @param options Further options on how to fetch updates
 * @returns A function that can fetch updates with automatic retry behavior
 */
export declare function createUpdateFetcher<Y extends {
    update_id: number;
}, R>(bot: BotAdapter<Y, R>, options?: RunnerOptions): (batchSize: number, signal: AbortSignal) => Promise<Y[]>;
/**
 * Creates a runner that pulls in updates from the supplied source, and passes
 * them to the supplied sink. Returns a handle that lets you control the runner,
 * e.g. start it.
 *
 * @param source The source of updates
 * @param sink The sink for updates
 * @returns A handle to start and manage your bot
 */
export declare function createRunner<Y>(source: UpdateSource<Y>, sink: UpdateSink<Y>): RunnerHandle;
import { AbortSignal } from "./node-shim.js";
export {};
