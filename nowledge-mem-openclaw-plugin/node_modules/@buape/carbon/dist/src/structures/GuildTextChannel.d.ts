import { type APIGuildTextChannel, type ChannelType } from "discord-api-types/v10";
import { BaseGuildTextChannel } from "../abstracts/BaseGuildTextChannel.js";
import type { IfPartial } from "../types/index.js";
export declare class GuildTextChannel<IsPartial extends boolean = false> extends BaseGuildTextChannel<ChannelType.GuildText, IsPartial> {
    rawData: APIGuildTextChannel<ChannelType.GuildText> | null;
    /**
     * The position of the channel in the channel list.
     */
    get position(): IfPartial<IsPartial, number>;
    /**
     * Set the position of the channel
     * @param position The new position of the channel
     */
    setPosition(position: number): Promise<void>;
    /**
     * The default auto archive duration of threads in the channel.
     */
    get defaultAutoArchiveDuration(): IfPartial<IsPartial, number | null>;
    /**
     * The default thread rate limit per user of the channel.
     */
    get defaultThreadRateLimitPerUser(): IfPartial<IsPartial, number | null>;
}
//# sourceMappingURL=GuildTextChannel.d.ts.map