import type { Context } from "../../abstracts/Plugin.js";
import type { Client } from "../../classes/Client.js";
import type { ClientManager } from "../../plugins/client-manager/ClientManager.js";
export type Handler = (req: Request, ctx: Context) => Promise<Response>;
/**
 * Creates a fetch handler function for the client or client manager routes
 * @param client The client or client manager to create the handler for
 * @returns The handler function
 */
export declare function createHandler(client: Client | ClientManager): Handler;
//# sourceMappingURL=index.d.ts.map