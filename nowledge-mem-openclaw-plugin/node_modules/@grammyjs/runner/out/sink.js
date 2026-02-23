"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createConcurrentSink = exports.createBatchSink = exports.createSequentialSink = void 0;
const queue_js_1 = require("./queue.js");
/**
 * Creates an update sink that handles updates sequentially, i.e. one after
 * another. No update will be processed before the previous update has not
 * either been processed, or its processing has failed and the error has been
 * handled.
 *
 * In the context of grammY, this is also the default behavior of the built-in
 * `bot.start` method. Sequential sinks are very predictable and hence are well
 * suited for debugging your bot. They do not scale well and should hence not be
 * used in a larger bot, or one with long-running middleware.
 *
 * @param handler Update consumer
 * @param errorHandler Error handler for when the update consumer rejects
 * @param options Further options for creating the sink
 * @returns An update sink that handles updates one by one
 */
function createSequentialSink(handler, errorHandler, options = {}) {
    var _a;
    const { milliseconds: timeout = Infinity, handler: timeoutHandler = () => { }, } = (_a = options.timeout) !== null && _a !== void 0 ? _a : {};
    const q = new queue_js_1.DecayingDeque(timeout, handler.consume, false, errorHandler, timeoutHandler);
    return {
        handle: async (updates) => {
            const len = updates.length;
            for (let i = 0; i < len; i++)
                await q.add([updates[i]]);
            return Infinity;
        },
        size: () => q.length,
        snapshot: () => q.pendingTasks(),
    };
}
exports.createSequentialSink = createSequentialSink;
/**
 * Creates an update sink that handles updates in batches. In other words, all
 * updates of one batch are processed concurrently, but one batch has to be done
 * processing before the next batch will be processed.
 *
 * In the context of grammY, creating a batch sink is rarely useful. If you want
 * to process updates concurrently, consider creating a concurrent sink. If you
 * want to process updates sequentially, consider using a sequential sink.
 *
 * This method was mainly added to provide compatibility with older frameworks
 * such as `telegraf`. If your bot specifically relies on this behavior, you may
 * want to choose creating a batch sink for compatibility reasons.
 *
 * @param handler Update consumer
 * @param errorHandler Error handler for when the update consumer rejects
 * @param options Further options for creating the sink
 * @returns An update sink that handles updates batch by batch
 */
function createBatchSink(handler, errorHandler, options = {}) {
    var _a;
    const { milliseconds: timeout = Infinity, handler: timeoutHandler = () => { }, } = (_a = options.timeout) !== null && _a !== void 0 ? _a : {};
    const q = new queue_js_1.DecayingDeque(timeout, handler.consume, false, errorHandler, timeoutHandler);
    const constInf = () => Infinity;
    return {
        handle: (updates) => q.add(updates).then(constInf),
        size: () => q.length,
        snapshot: () => q.pendingTasks(),
    };
}
exports.createBatchSink = createBatchSink;
/**
 * Creates an update sink that handles updates concurrently. In other words, new
 * updates will be fetched—and their processing will be started—before the
 * processing of older updates completes. The maximal number of concurrently
 * handled updates can be limited (default: 500).
 *
 * In the context of grammY, this is the sink that is created by default when
 * calling `run(bot)`.
 *
 * @param handler Update consumer
 * @param errorHandler Error handler for when the update consumer rejects
 * @param concurrency Maximal number of updates to process concurrently
 * @param options Further options for creating the sink
 * @returns An update sink that handles updates concurrently
 */
function createConcurrentSink(handler, errorHandler, options = {}) {
    const { concurrency = 500, timeout: { milliseconds: timeout = Infinity, handler: timeoutHandler = () => { }, } = {}, } = options;
    const q = new queue_js_1.DecayingDeque(timeout, handler.consume, concurrency, errorHandler, timeoutHandler);
    return {
        handle: (updates) => q.add(updates),
        size: () => q.length,
        snapshot: () => q.pendingTasks(),
    };
}
exports.createConcurrentSink = createConcurrentSink;
