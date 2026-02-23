import { Plugin } from "../../abstracts/Plugin.js";
import { GuildDelete } from "./GuildDeleteListener.js";
import { VoiceServerUpdate } from "./VoiceServerUpdateListener.js";
import { VoiceStateUpdate } from "./VoiceStateUpdateListener.js";
export class VoicePlugin extends Plugin {
    id = "voice";
    client;
    adapters = new Map();
    shardingPlugin;
    gatewayPlugin;
    async registerClient(client) {
        this.client = client;
        const sharding = this.client.getPlugin("sharding");
        if (sharding) {
            this.shardingPlugin = sharding;
        }
        const gateway = this.client.getPlugin("gateway");
        if (gateway) {
            this.gatewayPlugin = gateway;
        }
        if (!this.gatewayPlugin && !this.shardingPlugin) {
            throw new Error("Voice cannot be used without a gateway connection.");
        }
        this.client.registerListener(new GuildDelete());
        this.client.registerListener(new VoiceStateUpdate());
        this.client.registerListener(new VoiceServerUpdate());
    }
    getGateway(guild_id) {
        if (this.shardingPlugin) {
            return this.shardingPlugin.getShardForGuild(guild_id);
        }
        return this.gatewayPlugin;
    }
    getGatewayAdapterCreator(guild_id) {
        const gateway = this.getGateway(guild_id);
        if (!gateway) {
            throw new Error("Voice cannot be used without a gateway connection.");
        }
        return (methods) => {
            this.adapters.set(guild_id, methods);
            return {
                sendPayload(payload) {
                    try {
                        gateway.send(payload, true);
                        return true;
                    }
                    catch {
                        return false;
                    }
                },
                destroy: () => {
                    this.adapters.delete(guild_id);
                }
            };
        };
    }
}
//# sourceMappingURL=VoicePlugin.js.map