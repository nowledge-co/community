"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.distribute = void 0;
const platform_node_js_1 = require("./platform.node.js");
class ThreadPool {
    constructor(specifier, me, count = 4) {
        this.count = count;
        this.threads = [];
        this.tasks = new Map();
        for (let i = 0; i < count; i++) {
            const thread = (0, platform_node_js_1.createThread)(specifier, me);
            thread.onMessage((update_id) => {
                const task = this.tasks.get(update_id);
                task === null || task === void 0 ? void 0 : task();
                this.tasks.delete(update_id);
            });
            this.threads.push(thread);
        }
    }
    async process(update) {
        const i = update.update_id % this.count;
        this.threads[i].postMessage(update);
        await new Promise((resolve) => {
            this.tasks.set(update.update_id, resolve);
        });
    }
}
const workers = new Map();
function getWorker(specifier, me, count) {
    let worker = workers.get(specifier);
    if (worker === undefined) {
        worker = new ThreadPool(specifier, me, count);
        workers.set(specifier, worker);
    }
    return worker;
}
/**
 * Creates middleware that distributes updates across cores.
 *
 * This function should be used in combination with the `BotWorker` class.
 * Create an instance of `BotWorker` in a separate file. Let's assume that this
 * file is called `worker.ts`. This will define your actual bot logic.
 *
 * You can now do
 *
 * ```ts
 * const bot = new Bot("");
 *
 * // Deno:
 * bot.use(distribute(new URL("./worker.ts", import.meta.url)));
 * // Node:
 * bot.use(distribute(__dirname + "/worker"));
 * ```
 *
 * in a central place to use the bot worker in `worker.ts` and send updates to
 * it.
 *
 * Under the hood, `distribute` will create several web workers (Deno) or worker
 * threads (Node) using `worker.ts`. Updates are distributed among them in a
 * round-robin fashion.
 *
 * You can adjust the number of workers via `count` in an options object which
 * is passed as a second argument, i.e. `distribute(specifier, { count: 8 })`.
 * By default, 4 workers are created.
 *
 * @param specifier Module specifier to a file which creates a `BotWorker`
 * @param options Further options to control the number of workers
 */
function distribute(specifier, options) {
    const count = options === null || options === void 0 ? void 0 : options.count;
    return (ctx) => getWorker(specifier, ctx.me, count).process(ctx.update);
}
exports.distribute = distribute;
