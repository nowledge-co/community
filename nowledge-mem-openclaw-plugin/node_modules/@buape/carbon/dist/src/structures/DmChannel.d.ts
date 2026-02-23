import { type ChannelType } from "discord-api-types/v10";
import { BaseChannel } from "../abstracts/BaseChannel.js";
import type { IfPartial, MessagePayload } from "../types/index.js";
import { Message } from "./Message.js";
/**
 * Represents a DM between two users.
 */
export declare class DmChannel<IsPartial extends boolean = false> extends BaseChannel<ChannelType.DM, IsPartial> {
    /**
     * The name of the channel. This is always null for DM channels.
     */
    get name(): IfPartial<IsPartial, null>;
    /**
     * Send a message to the channel
     */
    send(message: MessagePayload): Promise<Message<false>>;
    /**
     * Trigger a typing indicator in the channel (this will expire after 10 seconds)
     */
    triggerTyping(): Promise<void>;
}
//# sourceMappingURL=DmChannel.d.ts.map