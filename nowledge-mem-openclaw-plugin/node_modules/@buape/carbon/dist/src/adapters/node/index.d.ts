import * as Hono from "@hono/node-server";
import type { Client } from "../../index.js";
import type { ClientManager } from "../../plugins/client-manager/ClientManager.js";
export type Server = Hono.ServerType;
export type ServerOptions = Omit<Parameters<typeof Hono.serve>[0], "fetch">;
/**
 * Creates a server for the client or client manager using Hono.serve under the hood
 * @param client The Carbon client or client manager to create the server for
 * @param options Additional options for the server
 * @returns The server instance
 */
export declare function createServer(client: Client | ClientManager, options: ServerOptions): Server;
//# sourceMappingURL=index.d.ts.map