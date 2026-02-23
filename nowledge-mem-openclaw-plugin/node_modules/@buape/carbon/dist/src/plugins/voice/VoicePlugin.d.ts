import type { DiscordGatewayAdapterCreator, DiscordGatewayAdapterLibraryMethods } from "@discordjs/voice";
import { Plugin } from "../../abstracts/Plugin.js";
import type { Client } from "../../classes/Client.js";
import type { GatewayPlugin } from "../gateway/index.js";
export declare class VoicePlugin extends Plugin {
    readonly id = "voice";
    protected client?: Client;
    readonly adapters: Map<string, DiscordGatewayAdapterLibraryMethods>;
    private shardingPlugin?;
    private gatewayPlugin?;
    registerClient(client: Client): Promise<void>;
    getGateway(guild_id: string): GatewayPlugin | undefined;
    getGatewayAdapterCreator(guild_id: string): DiscordGatewayAdapterCreator;
}
//# sourceMappingURL=VoicePlugin.d.ts.map