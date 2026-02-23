import { GatewayPlugin } from "../gateway/GatewayPlugin.js";
import type { GatewayPluginOptions } from "../gateway/types.js";
export interface GatewayForwarderPluginOptions extends GatewayPluginOptions {
    /**
     * The URL to forward webhook events to.
     * Typically this is your base URL in the client, and then `/events`
     */
    webhookUrl: string;
    /**
     * Optional headers to add to the webhook request.
     */
    webhookHeaders?: Record<string, string>;
    /**
     * The ed25519 private key in PEM format, used to sign forwarded events.
     * This should include the BEGIN/END markers. When loading from an environment
     * variable, the newlines can be escaped (\\n).
     *
     * For instructions on generating keys and setting up the forwarder,
     * see the documentation at: https://carbon.buape.com/plugins/gateway-forwarder
     */
    privateKey: string;
}
export declare class GatewayForwarderPlugin extends GatewayPlugin {
    readonly id: "gateway";
    readonly options: GatewayForwarderPluginOptions;
    private privateKey;
    constructor(options: GatewayForwarderPluginOptions);
    protected setupWebSocket(): void;
}
//# sourceMappingURL=GatewayForwarderPlugin.d.ts.map