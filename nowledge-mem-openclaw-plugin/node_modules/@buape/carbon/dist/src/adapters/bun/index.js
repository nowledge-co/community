import Bun from "bun";
import { createHandler } from "../fetch/index.js";
/**
 * Creates a server for the client or client manager using Bun.serve
 * @param client The Carbon client or client manager to create the server for
 * @param options Additional options for the server
 * @returns The Bun.Server instance
 */
export function createServer(client, options) {
    const fetch = createHandler(client);
    return Bun.serve({
        ...options,
        fetch: (r) => fetch(r, {})
    });
}
//# sourceMappingURL=index.js.map