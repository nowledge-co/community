import type { APIGuildForumChannel, ChannelType, ForumLayoutType } from "discord-api-types/v10";
import { GuildThreadOnlyChannel } from "../abstracts/GuildThreadOnlyChannel.js";
import type { IfPartial } from "../types/index.js";
/**
 * Represents a guild forum channel.
 */
export declare class GuildForumChannel<IsPartial extends boolean = false> extends GuildThreadOnlyChannel<ChannelType.GuildForum, IsPartial> {
    rawData: APIGuildForumChannel | null;
    /**
     * The default forum layout of the channel.
     */
    get defaultForumLayout(): IfPartial<IsPartial, ForumLayoutType | null>;
}
//# sourceMappingURL=GuildForumChannel.d.ts.map