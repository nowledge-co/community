import { createPrivateKey, sign } from "node:crypto";
import { ApplicationWebhookType } from "discord-api-types/v10";
import { concatUint8Arrays, valueToUint8Array } from "../../utils/index.js";
import { GatewayPlugin } from "../gateway/GatewayPlugin.js";
export class GatewayForwarderPlugin extends GatewayPlugin {
    id = "gateway-forwarder";
    options;
    privateKey;
    constructor(options) {
        if (!options.privateKey) {
            throw new Error("privateKey is required for GatewayForwarderPlugin");
        }
        super(options);
        try {
            const keyString = options.privateKey.replace(/\\n/g, "\n");
            this.privateKey = createPrivateKey({
                key: keyString,
                format: "pem"
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to parse private key: ${message}`);
        }
        this.options = options;
    }
    setupWebSocket() {
        super.setupWebSocket();
        if (!this.ws)
            return;
        this.ws.on("message", async (data) => {
            try {
                const payload = JSON.parse(data.toString());
                if (payload.t && payload.d) {
                    if (this.options.eventFilter &&
                        !this.options.eventFilter(payload.t))
                        return;
                    // In the below code, the events are not truly webhook events,
                    // but we use the webhook event type so that the payloads are structured correctly to work as if they were webhook events
                    const timestamp = Date.now();
                    const webhookEvent = {
                        version: 1,
                        application_id: this.client?.options.clientId || "unknown",
                        type: ApplicationWebhookType.Event,
                        event: {
                            type: payload.t,
                            timestamp: new Date().toISOString(),
                            data: payload.d
                        }
                    };
                    const body = JSON.stringify(webhookEvent);
                    const timestampData = valueToUint8Array(timestamp.toString());
                    const bodyData = valueToUint8Array(body);
                    const message = concatUint8Arrays(timestampData, bodyData);
                    const signature = sign(null, message, this.privateKey);
                    const signatureHex = signature.toString("hex");
                    const headers = new Headers(this.options.webhookHeaders);
                    const response = await fetch(this.options.webhookUrl, {
                        method: "POST",
                        headers: {
                            ...headers,
                            "Content-Type": "application/json",
                            "X-Signature-Ed25519": signatureHex,
                            "X-Signature-Timestamp": timestamp.toString()
                        },
                        body
                    });
                    await response.text().catch(() => { });
                    if (!response.ok) {
                        console.error(`Failed to forward event ${payload.t}: ${response.status} ${response.statusText}`);
                    }
                }
            }
            catch (error) {
                console.error("Error forwarding webhook event:", error);
            }
        });
    }
}
//# sourceMappingURL=GatewayForwarderPlugin.js.map