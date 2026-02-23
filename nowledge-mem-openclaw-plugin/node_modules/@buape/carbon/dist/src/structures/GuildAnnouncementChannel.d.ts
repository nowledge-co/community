import { type APIGuildTextChannel, type ChannelType } from "discord-api-types/v10";
import { BaseGuildTextChannel } from "../abstracts/BaseGuildTextChannel.js";
import type { IfPartial } from "../types/index.js";
import type { GuildTextChannel } from "./GuildTextChannel.js";
/**
 * Represents a guild announcement channel.
 */
export declare class GuildAnnouncementChannel<IsPartial extends boolean = false> extends BaseGuildTextChannel<ChannelType.GuildAnnouncement, IsPartial> {
    rawData: APIGuildTextChannel<ChannelType.GuildAnnouncement> | null;
    /**
     * The position of the channel in the channel list.
     */
    get position(): IfPartial<IsPartial, number>;
    /**
     * Set the position of the channel
     * @param position The new position of the channel
     */
    setPosition(position: number): Promise<void>;
    follow(targetChannel: GuildTextChannel | string): Promise<void>;
}
//# sourceMappingURL=GuildAnnouncementChannel.d.ts.map