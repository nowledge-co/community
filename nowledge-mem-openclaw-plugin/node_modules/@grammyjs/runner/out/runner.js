"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRunner = exports.createUpdateFetcher = exports.run = void 0;
const sink_js_1 = require("./sink.js");
const source_js_1 = require("./source.js");
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
function run(bot, options = {}) {
    const { source: sourceOpts, runner: runnerOpts, sink: sinkOpts } = options;
    // create update fetch function
    const fetchUpdates = createUpdateFetcher(bot, runnerOpts);
    // create source
    const supplier = {
        supply: async function (batchSize, signal) {
            if (bot.init !== undefined)
                await bot.init();
            const updates = await fetchUpdates(batchSize, signal);
            supplier.supply = fetchUpdates;
            return updates;
        },
    };
    const source = (0, source_js_1.createSource)(supplier, sourceOpts);
    // create sink
    const consumer = {
        consume: (update) => bot.handleUpdate(update),
    };
    const sink = (0, sink_js_1.createConcurrentSink)(consumer, async (error) => {
        try {
            await bot.errorHandler(error);
        }
        catch (error) {
            printError(error);
        }
    }, sinkOpts);
    // launch
    const runner = createRunner(source, sink);
    runner.start();
    return runner;
}
exports.run = run;
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
function createUpdateFetcher(bot, options = {}) {
    const { fetch: fetchOpts, retryInterval = "exponential", maxRetryTime = 15 * 60 * 60 * 1000, // 15 hours in milliseconds
    silent, } = options;
    const backoff = retryInterval === "exponential"
        ? (t) => t + t
        : retryInterval === "quadratic"
            ? (t) => t + 100
            : (t) => t;
    const initialRetryIn = typeof retryInterval === "number"
        ? retryInterval
        : 100;
    let offset = 0;
    async function fetchUpdates(batchSize, signal) {
        var _a;
        const args = {
            timeout: 30,
            ...fetchOpts,
            offset,
            limit: Math.max(1, Math.min(batchSize, 100)), // 1 <= batchSize <= 100
        };
        const latestRetry = Date.now() + maxRetryTime;
        let retryIn = initialRetryIn;
        let updates;
        do {
            try {
                updates = await bot.api.getUpdates(args, signal);
            }
            catch (error) {
                // do not retry if stopped
                if (signal.aborted)
                    throw error;
                if (!silent) {
                    console.error("[grammY runner] Error while fetching updates:");
                    console.error("[grammY runner]", error);
                }
                // preventing retries on unrecoverable errors
                await throwIfUnrecoverable(error);
                if (Date.now() + retryIn < latestRetry) {
                    await new Promise((r) => setTimeout(r, retryIn));
                    retryIn = backoff(retryIn);
                }
                else {
                    // do not retry for longer than `maxRetryTime`
                    throw error;
                }
            }
        } while (updates === undefined);
        const lastId = (_a = updates[updates.length - 1]) === null || _a === void 0 ? void 0 : _a.update_id;
        if (lastId !== undefined)
            offset = lastId + 1;
        return updates;
    }
    return fetchUpdates;
}
exports.createUpdateFetcher = createUpdateFetcher;
/**
 * Creates a runner that pulls in updates from the supplied source, and passes
 * them to the supplied sink. Returns a handle that lets you control the runner,
 * e.g. start it.
 *
 * @param source The source of updates
 * @param sink The sink for updates
 * @returns A handle to start and manage your bot
 */
function createRunner(source, sink) {
    let running = false;
    let task;
    async function runner() {
        if (!running)
            return;
        try {
            for await (const updates of source.generator()) {
                const capacity = await sink.handle(updates);
                if (!running)
                    break;
                source.setGeneratorPace(capacity);
            }
        }
        catch (e) {
            // Error is thrown when `stop` is called, so we only rethrow the
            // error if the bot was not already stopped intentionally before.
            if (running) {
                running = false;
                task = undefined;
                throw e;
            }
        }
        running = false;
        task = undefined;
    }
    return {
        start: () => {
            running = true;
            task = runner();
        },
        size: () => sink.size(),
        stop: () => {
            const t = task;
            running = false;
            task = undefined;
            source.close();
            return t;
        },
        task: () => task,
        isRunning: () => running && source.isActive(),
    };
}
exports.createRunner = createRunner;
async function throwIfUnrecoverable(err) {
    if (typeof err !== "object" || err === null)
        return;
    const code = "error_code" in err ? err.error_code : undefined;
    if (code === 401 || code === 409)
        throw err; // unauthorized or conflict
    if (code === 429) {
        // server is closing, must wait some seconds
        if ("parameters" in err &&
            typeof err.parameters === "object" &&
            err.parameters !== null &&
            "retry_after" in err.parameters &&
            typeof err.parameters.retry_after === "number") {
            const delay = err.parameters.retry_after;
            await new Promise((r) => setTimeout(r, 1000 * delay));
        }
    }
}
function printError(error) {
    console.error("::: ERROR ERROR ERROR :::");
    console.error();
    console.error("The error handling of your bot threw");
    console.error("an error itself! Make sure to handle");
    console.error("all errors! Time:", new Date().toISOString());
    console.error();
    console.error("The default error handler rethrows all");
    console.error("errors. Did you maybe forget to set");
    console.error("an error handler with `bot.catch`?");
    console.error();
    console.error("Here is your error object:");
    console.error(error);
}
