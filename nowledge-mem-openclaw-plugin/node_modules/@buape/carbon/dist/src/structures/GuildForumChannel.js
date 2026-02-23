import { GuildThreadOnlyChannel } from "../abstracts/GuildThreadOnlyChannel.js";
/**
 * Represents a guild forum channel.
 */
export class GuildForumChannel extends GuildThreadOnlyChannel {
    /**
     * The default forum layout of the channel.
     */
    get defaultForumLayout() {
        if (!this.rawData)
            return undefined;
        return this.rawData.default_forum_layout;
    }
}
//# sourceMappingURL=GuildForumChannel.js.map