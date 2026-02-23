import Bun from "bun";
import type { Client } from "../../index.js";
import type { ClientManager } from "../../plugins/client-manager/ClientManager.js";
export type Server = ReturnType<typeof Bun.serve>;
export type ServerOptions = Parameters<typeof Bun.serve>[0];
/**
 * Creates a server for the client or client manager using Bun.serve
 * @param client The Carbon client or client manager to create the server for
 * @param options Additional options for the server
 * @returns The Bun.Server instance
 */
export declare function createServer(client: Client | ClientManager, options: ServerOptions): Server;
//# sourceMappingURL=index.d.ts.map