import type { APIGuildMediaChannel, ChannelType } from "discord-api-types/v10";
import { GuildThreadOnlyChannel } from "../abstracts/GuildThreadOnlyChannel.js";
/**
 * Represents a guild media channel (a forum channel)
 */
export declare class GuildMediaChannel extends GuildThreadOnlyChannel<ChannelType.GuildMedia> {
    rawData: APIGuildMediaChannel | null;
}
//# sourceMappingURL=GuildMediaChannel.d.ts.map