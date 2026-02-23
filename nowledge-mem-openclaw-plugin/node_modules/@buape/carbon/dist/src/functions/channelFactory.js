import { ChannelType } from "discord-api-types/v10";
import { DmChannel } from "../structures/DmChannel.js";
import { GroupDmChannel } from "../structures/GroupDmChannel.js";
import { GuildAnnouncementChannel } from "../structures/GuildAnnouncementChannel.js";
import { GuildCategoryChannel } from "../structures/GuildCategoryChannel.js";
import { GuildForumChannel } from "../structures/GuildForumChannel.js";
import { GuildMediaChannel } from "../structures/GuildMediaChannel.js";
import { GuildStageChannel, GuildVoiceChannel } from "../structures/GuildStageOrVoiceChannel.js";
import { GuildTextChannel } from "../structures/GuildTextChannel.js";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
export const channelFactory = (client, channelData) => {
    switch (channelData.type) {
        case ChannelType.DM:
            return new DmChannel(client, channelData);
        case ChannelType.GroupDM:
            return new GroupDmChannel(client, channelData);
        case ChannelType.GuildText:
            return new GuildTextChannel(client, channelData);
        case ChannelType.GuildVoice:
            return new GuildVoiceChannel(client, channelData);
        case ChannelType.GuildCategory:
            return new GuildCategoryChannel(client, channelData);
        case ChannelType.GuildAnnouncement:
            return new GuildAnnouncementChannel(client, channelData);
        case ChannelType.AnnouncementThread:
        case ChannelType.PublicThread:
        case ChannelType.PrivateThread:
            return new GuildThreadChannel(client, channelData);
        case ChannelType.GuildStageVoice:
            return new GuildStageChannel(client, channelData);
        case ChannelType.GuildForum:
            return new GuildForumChannel(client, channelData);
        case ChannelType.GuildMedia:
            return new GuildMediaChannel(client, channelData);
        default:
            return null;
    }
};
//# sourceMappingURL=channelFactory.js.map