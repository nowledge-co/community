import { type Update } from "../types.js";
type MaybePromise<T> = T | Promise<T>;
/**
 * Abstraction over a request-response cycle, providing access to the update, as
 * well as a mechanism for responding to the request and to end it.
 */
export interface ReqResHandler<T = void> {
    /**
     * The update object sent from Telegram, usually resolves the request's JSON
     * body
     */
    update: MaybePromise<Update>;
    /**
     * X-Telegram-Bot-Api-Secret-Token header of the request, or undefined if
     * not present
     */
    header?: string;
    /**
     * Ends the request immediately without body, called after every request
     * unless a webhook reply was performed
     */
    end?: () => void;
    /**
     * Sends the specified JSON as a payload in the body, used for webhook
     * replies
     */
    respond: (json: string) => unknown | Promise<unknown>;
    /**
     * Responds that the request is unauthorized due to mismatching
     * X-Telegram-Bot-Api-Secret-Token headers
     */
    unauthorized: () => unknown | Promise<unknown>;
    /**
     * Some frameworks (e.g. Deno's std/http `listenAndServe`) assume that
     * handler returns something
     */
    handlerReturn?: Promise<T>;
}
/**
 * Middleware for a web framework. Creates a request-response handler for a
 * request. The handler will be used to integrate with the compatible framework.
 */
export type FrameworkAdapter = (...args: any[]) => ReqResHandler<any>;
export type LambdaAdapter = (event: {
    body?: string;
    headers: Record<string, string | undefined>;
}, _context: unknown, callback: (arg0: unknown, arg1: Record<string, unknown>) => Promise<unknown>) => ReqResHandler;
export type LambdaAsyncAdapter = (event: {
    body?: string;
    headers: Record<string, string | undefined>;
}, _context: unknown) => ReqResHandler;
export type AzureAdapter = (context: {
    res?: {
        [key: string]: any;
    };
}, request: {
    body?: unknown;
}) => ReqResHandler;
export type AzureAdapterV4 = (request: {
    headers: {
        get(name: string): string | null;
    };
    json(): Promise<unknown>;
}) => ReqResHandler<{
    status: number;
    body?: string;
} | {
    jsonBody: string;
}>;
export type BunAdapter = (request: {
    headers: Headers;
    json: () => Promise<unknown>;
}) => ReqResHandler<Response>;
export type CloudflareAdapter = (event: {
    request: Body & {
        method: string;
        url: string;
        headers: Headers;
    };
    respondWith: (response: Promise<Response>) => void;
}) => ReqResHandler;
export type CloudflareModuleAdapter = (request: Body & {
    method: string;
    url: string;
    headers: Headers;
}) => ReqResHandler<Response>;
export type ElysiaAdapter = (ctx: {
    body: unknown;
    headers: Record<string, string | undefined>;
    set: {
        headers: Record<string, string | number>;
        status?: string | number;
    };
}) => ReqResHandler<string>;
export type ExpressAdapter = (req: {
    body: Update;
    header: (header: string) => string | undefined;
}, res: {
    end: (cb?: () => void) => typeof res;
    set: (field: string, value?: string | string[]) => typeof res;
    send: (json: string) => typeof res;
    status: (code: number) => typeof res;
}) => ReqResHandler;
export type FastifyAdapter = (request: {
    body: unknown;
    headers: any;
}, reply: {
    status: (code: number) => typeof reply;
    headers: (headers: Record<string, string>) => typeof reply;
    code: (code: number) => typeof reply;
    send: {
        (): typeof reply;
        (json: string): typeof reply;
    };
}) => ReqResHandler;
export type HonoAdapter = (c: {
    req: {
        json: <T>() => Promise<T>;
        header: (header: string) => string | undefined;
    };
    body(data: string): Response;
    body(data: null, status: 204): Response;
    status: (status: any) => void;
    json: (json: string) => Response;
}) => ReqResHandler<Response>;
export type HttpAdapter = (req: {
    headers: Record<string, string | string[] | undefined>;
    on: (event: string, listener: (chunk: unknown) => void) => typeof req;
    once: (event: string, listener: () => void) => typeof req;
}, res: {
    writeHead: {
        (status: number): typeof res;
        (status: number, headers: Record<string, string>): typeof res;
    };
    end: (json?: string) => void;
}) => ReqResHandler;
export type KoaAdapter = (ctx: {
    get: (header: string) => string | undefined;
    set: (key: string, value: string) => void;
    status: number;
    body: string;
    request: {
        body?: unknown;
    };
    response: {
        body: unknown;
        status: number;
    };
}) => ReqResHandler;
export type NextAdapter = (req: {
    body: Update;
    headers: Record<string, string | string[] | undefined>;
}, res: {
    end: (cb?: () => void) => typeof res;
    status: (code: number) => typeof res;
    json: (json: string) => any;
    send: (json: string) => any;
}) => ReqResHandler;
export type NHttpAdapter = (rev: {
    body: unknown;
    headers: {
        get: (header: string) => string | null;
    };
    response: {
        sendStatus: (status: number) => void;
        status: (status: number) => {
            send: (json: string) => void;
        };
    };
}) => ReqResHandler;
export type OakAdapter = (ctx: {
    request: {
        body: {
            json: () => Promise<Update>;
        };
        headers: {
            get: (header: string) => string | null;
        };
    };
    response: {
        status: number;
        type: string | undefined;
        body: unknown;
    };
}) => ReqResHandler;
export type ServeHttpAdapter = (requestEvent: {
    request: Request;
    respondWith: (response: Response) => void;
}) => ReqResHandler;
export type StdHttpAdapter = (req: Request) => ReqResHandler<Response>;
export type SveltekitAdapter = ({ request }: {
    request: Request;
}) => ReqResHandler<unknown>;
export type WorktopAdapter = (req: {
    json: () => Promise<Update>;
    headers: {
        get: (header: string) => string | null;
    };
}, res: {
    end: (data: BodyInit | null) => void;
    send: (status: number, json: string) => void;
}) => ReqResHandler;
export declare const adapters: {
    "aws-lambda": LambdaAdapter;
    "aws-lambda-async": LambdaAsyncAdapter;
    azure: AzureAdapter;
    "azure-v4": AzureAdapterV4;
    bun: BunAdapter;
    cloudflare: CloudflareAdapter;
    "cloudflare-mod": CloudflareModuleAdapter;
    elysia: ElysiaAdapter;
    express: ExpressAdapter;
    fastify: FastifyAdapter;
    hono: HonoAdapter;
    http: HttpAdapter;
    https: HttpAdapter;
    koa: KoaAdapter;
    "next-js": NextAdapter;
    nhttp: NHttpAdapter;
    oak: OakAdapter;
    serveHttp: ServeHttpAdapter;
    "std/http": StdHttpAdapter;
    sveltekit: SveltekitAdapter;
    worktop: WorktopAdapter;
};
export {};
