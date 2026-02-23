import { Routes, VideoQualityMode } from "discord-api-types/v10";
import { BaseGuildChannel } from "../abstracts/BaseGuildChannel.js";
export class GuildStageOrVoiceChannel extends BaseGuildChannel {
    /**
     * The position of the channel in the channel list.
     */
    get position() {
        if (!this.rawData)
            return undefined;
        return this.rawData.position;
    }
    /**
     * Set the position of the channel
     * @param position The new position of the channel
     */
    async setPosition(position) {
        await this.client.rest.patch(Routes.channel(this.id), {
            body: {
                position
            }
        });
        this.setField("position", position);
    }
    /**
     * The bitrate of the channel.
     */
    get bitrate() {
        if (!this.rawData)
            return undefined;
        return this.rawData.bitrate;
    }
    /**
     * The user limit of the channel.
     */
    get userLimit() {
        if (!this.rawData)
            return undefined;
        return this.rawData.user_limit;
    }
    /**
     * The RTC region of the channel.
     * This is automatic when set to `null`.
     */
    get rtcRegion() {
        if (!this.rawData)
            return undefined;
        return this.rawData.rtc_region ?? null;
    }
    /**
     * The video quality mode of the channel.
     * 1 when not present.
     */
    get videoQualityMode() {
        if (!this.rawData)
            return undefined;
        return this.rawData.video_quality_mode ?? VideoQualityMode.Auto;
    }
}
export class GuildStageChannel extends GuildStageOrVoiceChannel {
}
export class GuildVoiceChannel extends GuildStageOrVoiceChannel {
}
//# sourceMappingURL=GuildStageOrVoiceChannel.js.map