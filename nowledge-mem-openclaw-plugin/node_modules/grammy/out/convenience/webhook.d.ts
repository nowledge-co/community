import { type Bot } from "../bot.js";
import { type Context } from "../context.js";
import { type FrameworkAdapter } from "./frameworks.js";
declare const adapters: {
    callback: FrameworkAdapter;
    "aws-lambda": import("./frameworks.js").LambdaAdapter;
    "aws-lambda-async": import("./frameworks.js").LambdaAsyncAdapter;
    azure: import("./frameworks.js").AzureAdapter;
    "azure-v4": import("./frameworks.js").AzureAdapterV4;
    bun: import("./frameworks.js").BunAdapter;
    cloudflare: import("./frameworks.js").CloudflareAdapter;
    "cloudflare-mod": import("./frameworks.js").CloudflareModuleAdapter;
    elysia: import("./frameworks.js").ElysiaAdapter;
    express: import("./frameworks.js").ExpressAdapter;
    fastify: import("./frameworks.js").FastifyAdapter;
    hono: import("./frameworks.js").HonoAdapter;
    http: import("./frameworks.js").HttpAdapter;
    https: import("./frameworks.js").HttpAdapter;
    koa: import("./frameworks.js").KoaAdapter;
    "next-js": import("./frameworks.js").NextAdapter;
    nhttp: import("./frameworks.js").NHttpAdapter;
    oak: import("./frameworks.js").OakAdapter;
    serveHttp: import("./frameworks.js").ServeHttpAdapter;
    "std/http": import("./frameworks.js").StdHttpAdapter;
    sveltekit: import("./frameworks.js").SveltekitAdapter;
    worktop: import("./frameworks.js").WorktopAdapter;
};
export interface WebhookOptions {
    /** An optional strategy to handle timeouts (default: 'throw') */
    onTimeout?: "throw" | "return" | ((...args: any[]) => unknown);
    /** An optional number of timeout milliseconds (default: 10_000) */
    timeoutMilliseconds?: number;
    /** An optional string to compare to X-Telegram-Bot-Api-Secret-Token */
    secretToken?: string;
}
type Adapters = typeof adapters;
type AdapterNames = keyof Adapters;
type ResolveName<A extends FrameworkAdapter | AdapterNames> = A extends AdapterNames ? Adapters[A] : A;
/**
 * Creates a callback function that you can pass to a web framework (such as
 * express) if you want to run your bot via webhooks. Use it like this:
 * ```ts
 * const app = express() // or whatever you're using
 * const bot = new Bot('<token>')
 *
 * app.use(webhookCallback(bot, 'express'))
 * ```
 *
 * Confer the grammY
 * [documentation](https://grammy.dev/guide/deployment-types) to read more
 * about how to run your bot with webhooks.
 *
 * @param bot The bot for which to create a callback
 * @param adapter An optional string identifying the framework (default: 'express')
 * @param webhookOptions Further options for the webhook setup
 */
export declare function webhookCallback<C extends Context = Context, A extends FrameworkAdapter | AdapterNames = FrameworkAdapter | AdapterNames>(bot: Bot<C>, adapter: A, webhookOptions?: WebhookOptions): (...args: Parameters<ResolveName<A>>) => ReturnType<ResolveName<A>>["handlerReturn"] extends undefined ? Promise<void> : NonNullable<ReturnType<ResolveName<A>>["handlerReturn"]>;
export declare function webhookCallback<C extends Context = Context, A extends FrameworkAdapter | AdapterNames = FrameworkAdapter | AdapterNames>(bot: Bot<C>, adapter: A, onTimeout?: WebhookOptions["onTimeout"], timeoutMilliseconds?: WebhookOptions["timeoutMilliseconds"], secretToken?: WebhookOptions["secretToken"]): (...args: Parameters<ResolveName<A>>) => ReturnType<ResolveName<A>>["handlerReturn"] extends undefined ? Promise<void> : NonNullable<ReturnType<ResolveName<A>>["handlerReturn"]>;
export {};
