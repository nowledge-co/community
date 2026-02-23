import { type APIGuildStageVoiceChannel, type APIGuildVoiceChannel, type ChannelType, VideoQualityMode } from "discord-api-types/v10";
import { BaseGuildChannel } from "../abstracts/BaseGuildChannel.js";
import type { IfPartial } from "../types/index.js";
export declare abstract class GuildStageOrVoiceChannel<Type extends ChannelType.GuildStageVoice | ChannelType.GuildVoice, IsPartial extends boolean = false> extends BaseGuildChannel<Type, IsPartial> {
    rawData: APIGuildStageVoiceChannel | APIGuildVoiceChannel | null;
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
     * The bitrate of the channel.
     */
    get bitrate(): IfPartial<IsPartial, number | undefined>;
    /**
     * The user limit of the channel.
     */
    get userLimit(): IfPartial<IsPartial, number | undefined>;
    /**
     * The RTC region of the channel.
     * This is automatic when set to `null`.
     */
    get rtcRegion(): IfPartial<IsPartial, string | null>;
    /**
     * The video quality mode of the channel.
     * 1 when not present.
     */
    get videoQualityMode(): IfPartial<IsPartial, VideoQualityMode>;
}
export declare class GuildStageChannel<IsPartial extends boolean = false> extends GuildStageOrVoiceChannel<ChannelType.GuildStageVoice, IsPartial> {
    rawData: APIGuildStageVoiceChannel | null;
}
export declare class GuildVoiceChannel<IsPartial extends boolean = false> extends GuildStageOrVoiceChannel<ChannelType.GuildVoice, IsPartial> {
    rawData: APIGuildVoiceChannel | null;
}
//# sourceMappingURL=GuildStageOrVoiceChannel.d.ts.map