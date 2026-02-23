import { Routes } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { maxPermissions } from "../permissions.js";
import { buildCDNUrl } from "../utils/index.js";
import { Role } from "./Role.js";
import { User } from "./User.js";
export class GuildMember extends Base {
    constructor(client, rawData, guild) {
        super(client);
        this._rawData = rawData;
        this.guild = guild;
        this.user = new User(client, rawData.user);
        this.setData(rawData);
    }
    _rawData = null;
    setData(data) {
        if (!data)
            throw new Error("Cannot set data without having data... smh");
        this._rawData = data;
    }
    setField(key, value) {
        if (!this._rawData)
            throw new Error("Cannot set field without having data... smh");
        Reflect.set(this._rawData, key, value);
    }
    /**
     * The raw Discord API data for this guild member
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial GuildMember. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The guild object of the member.
     */
    guild;
    /**
     * The user object of the member.
     */
    user;
    /**
     * The guild-specific nickname of the member.
     */
    get nickname() {
        if (!this._rawData)
            return undefined;
        return this._rawData.nick ?? null;
    }
    /**
     * The guild-specific avatar hash of the member.
     * You can use {@link GuildMember.avatarUrl} to get the URL of the avatar.
     */
    get avatar() {
        if (!this._rawData)
            return undefined;
        return this._rawData.avatar ?? null;
    }
    /**
     * Get the URL of the member's guild-specific avatar with default settings (png format)
     */
    get avatarUrl() {
        if (!this._rawData)
            return undefined;
        if (!this.user)
            return null;
        return buildCDNUrl(`https://cdn.discordapp.com/guilds/${this.guild.id}/users/${this.user.id}/avatars`, this.avatar);
    }
    /**
     * Get the URL of the member's guild-specific avatar with custom format and size options
     * @param options Optional format and size parameters
     * @returns The avatar URL or null if no avatar is set
     */
    getAvatarUrl(options) {
        if (!this._rawData)
            return undefined;
        if (!this.user)
            return null;
        return buildCDNUrl(`https://cdn.discordapp.com/guilds/${this.guild.id}/users/${this.user.id}/avatars`, this.avatar, options);
    }
    /**
     * Is this member muted in Voice Channels?
     */
    get mute() {
        if (!this._rawData)
            return undefined;
        return this._rawData.mute;
    }
    /**
     * Is this member deafened in Voice Channels?
     */
    get deaf() {
        if (!this._rawData)
            return undefined;
        return this._rawData.deaf;
    }
    /**
     * The date since this member boosted the guild, if applicable.
     */
    get premiumSince() {
        if (!this._rawData)
            return undefined;
        return this._rawData.premium_since ?? null;
    }
    /**
     * The flags of the member.
     * @see https://discord.com/developers/docs/resources/guild#guild-member-object-guild-member-flags
     */
    get flags() {
        if (!this._rawData)
            return undefined;
        return this._rawData.flags;
    }
    /**
     * The roles of the member
     */
    get roles() {
        if (!this._rawData)
            return undefined;
        const roles = this._rawData.roles ?? [];
        return roles.map((role) => new Role(this.client, role, this.guild.id));
    }
    /**
     * The joined date of the member
     */
    get joinedAt() {
        if (!this._rawData)
            return undefined;
        return this._rawData.joined_at;
    }
    /**
     * The date when the member's communication privileges (timeout) will be reinstated
     */
    get communicationDisabledUntil() {
        if (!this._rawData)
            return undefined;
        return this._rawData.communication_disabled_until ?? null;
    }
    /**
     * Is this member yet to pass the guild's Membership Screening requirements?
     */
    get pending() {
        if (!this._rawData)
            return undefined;
        return this._rawData.pending ?? false;
    }
    async getVoiceState() {
        const voiceState = (await this.client.rest.get(`/guilds/${this.guild.id}/members/${this.user.id}/voice`));
        if (!voiceState)
            return null;
        const voiceStateData = {
            channelId: voiceState.channel_id ?? null,
            guildId: this.guild.id,
            userId: this.user.id,
            sessionId: voiceState.session_id,
            deaf: voiceState.deaf ?? false,
            mute: voiceState.mute ?? false,
            selfDeaf: voiceState.self_deaf ?? false,
            selfMute: voiceState.self_mute ?? false,
            selfStream: voiceState.self_stream ?? false,
            selfVideo: voiceState.self_video ?? false,
            suppress: voiceState.suppress ?? false,
            requestToSpeakTimestamp: voiceState.request_to_speak_timestamp ?? null
        };
        return voiceStateData;
    }
    async getPermissions() {
        if (!this._rawData)
            return undefined;
        if (this.guild.ownerId === this.user.id)
            return maxPermissions;
        const permissions = await Promise.all(this.roles.map(async (x) => {
            if (x.partial)
                await x.fetch();
            if (!x.permissions)
                return undefined;
            return BigInt(x.permissions);
        }));
        const filteredPermissions = permissions.filter((x) => x !== undefined);
        return filteredPermissions;
    }
    /**
     * Set the nickname of the member
     */
    async setNickname(nickname, reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: {
                nick: nickname
            },
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        this.setField("nick", nickname);
    }
    /**
     * Set the member's guild-specific data
     * This will only work if the current member is the bot itself, and will throw an error if it is not
     */
    async setMemberData(data, reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: data,
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        if ("banner" in data)
            this.setField("banner", data.banner ?? null);
        if ("avatar" in data)
            this.setField("avatar", data.avatar ?? null);
    }
    /**
     * Add a role to the member
     */
    async addRole(roleId, reason) {
        await this.client.rest.put(`/guilds/${this.guild?.id}/members/${this.user?.id}/roles/${roleId}`, {
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        const ids = this._rawData?.roles ?? [];
        if (!ids.includes(roleId)) {
            this.setField("roles", [...ids, roleId]);
        }
    }
    /**
     * Remove a role from the member
     */
    async removeRole(roleId, reason) {
        await this.client.rest.delete(`/guilds/${this.guild?.id}/members/${this.user?.id}/roles/${roleId}`, {
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        const ids = (this._rawData?.roles ?? []).filter((id) => id !== roleId);
        this.setField("roles", ids);
    }
    /**
     * Kick the member from the guild
     */
    async kick(reason) {
        await this.client.rest.delete(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
    }
    /**
     * Ban the member from the guild
     */
    async ban(options = {}) {
        await this.client.rest.put(`/guilds/${this.guild?.id}/bans/${this.user?.id}`, {
            body: {
                reason: options.reason,
                delete_message_days: options.deleteMessageDays
            },
            headers: options.reason
                ? { "X-Audit-Log-Reason": options.reason }
                : undefined
        });
    }
    /**
     * Mute a member in voice channels
     */
    async muteMember(reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: {
                mute: true
            },
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        this.setField("mute", true);
    }
    /**
     * Unmute a member in voice channels
     */
    async unmuteMember(reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: {
                mute: false
            },
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        this.setField("mute", false);
    }
    /**
     * Deafen a member in voice channels
     */
    async deafenMember(reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: {
                deaf: true
            },
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        this.setField("deaf", true);
    }
    /**
     * Undeafen a member in voice channels
     */
    async undeafenMember(reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: {
                deaf: false
            },
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        this.setField("deaf", false);
    }
    /**
     * Set or remove a timeout for a member in the guild
     */
    async timeoutMember(communicationDisabledUntil, reason) {
        await this.client.rest.patch(`/guilds/${this.guild?.id}/members/${this.user?.id}`, {
            body: {
                communication_disabled_until: communicationDisabledUntil
            },
            headers: reason ? { "X-Audit-Log-Reason": reason } : undefined
        });
        this.setField("communication_disabled_until", communicationDisabledUntil);
    }
    async fetch() {
        const newData = (await this.client.rest.get(Routes.guildMember(this.guild.id, this.user.id)));
        if (!newData)
            throw new Error(`Member ${this.user.id} not found`);
        this.setData(newData);
        return this;
    }
}
//# sourceMappingURL=GuildMember.js.map