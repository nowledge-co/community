import { type UserFromGetMe } from "./deps.node.js";
import { type ModuleSpecifier } from "./platform.node.js";
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
export declare function distribute<C extends {
    update: {
        update_id: number;
    };
    me: UserFromGetMe;
}>(specifier: ModuleSpecifier, options?: {
    /** Number of workers to create */
    count?: number;
}): (ctx: C) => Promise<void>;
