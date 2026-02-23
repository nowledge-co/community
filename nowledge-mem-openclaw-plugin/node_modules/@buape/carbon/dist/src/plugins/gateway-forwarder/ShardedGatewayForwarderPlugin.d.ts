import { ShardingPlugin, type ShardingPluginOptions } from "../sharding/ShardingPlugin.js";
import type { GatewayForwarderPluginOptions } from "./GatewayForwarderPlugin.js";
import { GatewayForwarderPlugin } from "./GatewayForwarderPlugin.js";
export type ShardedGatewayForwarderPluginOptions = GatewayForwarderPluginOptions & ShardingPluginOptions;
export declare class ShardedGatewayForwarderPlugin extends ShardingPlugin {
    readonly id: "sharding";
    customGatewayPlugin: typeof GatewayForwarderPlugin;
}
//# sourceMappingURL=ShardedGatewayForwarderPlugin.d.ts.map