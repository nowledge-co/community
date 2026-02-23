import { type APIGuildCategoryChannel, type ChannelType } from "discord-api-types/v10";
import { BaseGuildChannel } from "../abstracts/BaseGuildChannel.js";
import type { IfPartial } from "../types/index.js";
/**
 * Represents a guild category channel.
 */
export declare class GuildCategoryChannel<IsPartial extends boolean = false> extends BaseGuildChannel<ChannelType.GuildCategory, IsPartial> {
    rawData: APIGuildCategoryChannel | null;
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
     * You cannot send a message to a category channel, so this method throws an error
     */
    send(): Promise<never>;
}
//# sourceMappingURL=GuildCategoryChannel.d.ts.map