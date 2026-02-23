import * as Hono from "@hono/node-server";
import { createHandler } from "../fetch/index.js";
/**
 * Creates a server for the client or client manager using Hono.serve under the hood
 * @param client The Carbon client or client manager to create the server for
 * @param options Additional options for the server
 * @returns The server instance
 */
export function createServer(client, options) {
    const fetch = createHandler(client);
    return Hono.serve({
        // Weird type issue with options.createServer ??
        ...options,
        fetch: (r) => fetch(r, {})
    });
}
//# sourceMappingURL=index.js.map