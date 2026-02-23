import { type APIChannel, ChannelType, type ThreadChannelType } from "discord-api-types/v10";
import type { Client } from "../classes/Client.js";
import { DmChannel } from "../structures/DmChannel.js";
import { GroupDmChannel } from "../structures/GroupDmChannel.js";
import { GuildAnnouncementChannel } from "../structures/GuildAnnouncementChannel.js";
import { GuildCategoryChannel } from "../structures/GuildCategoryChannel.js";
import { GuildForumChannel } from "../structures/GuildForumChannel.js";
import { GuildMediaChannel } from "../structures/GuildMediaChannel.js";
import { GuildStageChannel, GuildVoiceChannel } from "../structures/GuildStageOrVoiceChannel.js";
import { GuildTextChannel } from "../structures/GuildTextChannel.js";
import { GuildThreadChannel } from "../structures/GuildThreadChannel.js";
export type AnyChannel = DmChannel | GroupDmChannel | GuildTextChannel | GuildVoiceChannel | GuildStageChannel | GuildCategoryChannel | GuildAnnouncementChannel | GuildThreadChannel<ThreadChannelType> | GuildForumChannel | GuildMediaChannel;
export declare const channelFactory: (client: Client, channelData: APIChannel) => DmChannel<false> | GroupDmChannel<false> | GuildTextChannel<false> | GuildVoiceChannel<false> | GuildCategoryChannel<false> | GuildAnnouncementChannel<false> | GuildThreadChannel<ChannelType.AnnouncementThread | ChannelType.PublicThread | ChannelType.PrivateThread, false> | GuildStageChannel<false> | GuildForumChannel<false> | GuildMediaChannel | null;
//# sourceMappingURL=channelFactory.d.ts.map