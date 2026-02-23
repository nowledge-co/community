import { Plugin } from "../../abstracts/Plugin.js";
import type { Client } from "../../classes/Client.js";
/**
 * This plugin is a basic plugin that allows you to get the command data from the client over HTTP.
 * The JSON array provided here is the same as the one you would send to Discord, allowing you to build your own command deployment setup.
 */
export declare class CommandDataPlugin extends Plugin {
    readonly id = "command-data";
    client?: Client;
    registerClient(client: Client): void;
    registerRoutes(client: Client): void;
    private discordCommandData;
    handleFullCommandDataRequest(): Promise<Response>;
    handleCommandDataRequest(): Promise<Response>;
}
//# sourceMappingURL=CommandDataPlugin.d.ts.map