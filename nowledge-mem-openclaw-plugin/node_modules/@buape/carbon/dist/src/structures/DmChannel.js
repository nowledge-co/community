import { Routes } from "discord-api-types/v10";
import { BaseChannel } from "../abstracts/BaseChannel.js";
import { serializePayload } from "../utils/index.js";
import { Message } from "./Message.js";
/**
 * Represents a DM between two users.
 */
export class DmChannel extends BaseChannel {
    /**
     * The name of the channel. This is always null for DM channels.
     */
    get name() {
        if (!this.rawData)
            return undefined;
        return null;
    }
    /**
     * Send a message to the channel
     */
    async send(message) {
        const data = (await this.client.rest.post(Routes.channelMessages(this.id), {
            body: serializePayload(message)
        }));
        return new Message(this.client, data);
    }
    /**
     * Trigger a typing indicator in the channel (this will expire after 10 seconds)
     */
    async triggerTyping() {
        await this.client.rest.post(Routes.channelTyping(this.id), {});
    }
}
//# sourceMappingURL=DmChannel.js.map