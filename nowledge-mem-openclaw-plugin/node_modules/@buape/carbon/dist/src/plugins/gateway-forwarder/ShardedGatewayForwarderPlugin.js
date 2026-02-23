import { ShardingPlugin } from "../sharding/ShardingPlugin.js";
import { GatewayForwarderPlugin } from "./GatewayForwarderPlugin.js";
export class ShardedGatewayForwarderPlugin extends ShardingPlugin {
    id = "sharded-gateway-forwarder";
    customGatewayPlugin = GatewayForwarderPlugin;
}
//# sourceMappingURL=ShardedGatewayForwarderPlugin.js.map