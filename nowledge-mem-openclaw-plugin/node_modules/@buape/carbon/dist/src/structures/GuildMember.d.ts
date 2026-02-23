import { type APIGuildMember, type GuildMemberFlags } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import type { IfPartial, VoiceState } from "../types/index.js";
import { type CDNUrlOptions } from "../utils/index.js";
import type { Guild } from "./Guild.js";
import { Role } from "./Role.js";
import { User } from "./User.js";
type APIGuildMemberPartialVoice = Omit<APIGuildMember, "mute" | "deaf"> & {
    mute: boolean | undefined;
    deaf: boolean | undefined;
};
export declare class GuildMember<IsPartial extends false = false, IsGuildPartial extends boolean = false> extends Base {
    constructor(client: Client, rawData: APIGuildMemberPartialVoice, guild: Guild<IsGuildPartial>);
    protected _rawData: APIGuildMemberPartialVoice | null;
    private setData;
    private setField;
    /**
     * The raw Discord API data for this guild member
     */
    get rawData(): Readonly<APIGuildMemberPartialVoice>;
    /**
     * The guild object of the member.
     */
    guild: Guild<IsGuildPartial>;
    /**
     * The user object of the member.
     */
    user: User;
    /**
     * The guild-specific nickname of the member.
     */
    get nickname(): IfPartial<IsPartial, string | null>;
    /**
     * The guild-specific avatar hash of the member.
     * You can use {@link GuildMember.avatarUrl} to get the URL of the avatar.
     */
    get avatar(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the member's guild-specific avatar with default settings (png format)
     */
    get avatarUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the member's guild-specific avatar with custom format and size options
     * @param options Optional format and size parameters
     * @returns The avatar URL or null if no avatar is set
     */
    getAvatarUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * Is this member muted in Voice Channels?
     */
    get mute(): boolean | undefined;
    /**
     * Is this member deafened in Voice Channels?
     */
    get deaf(): boolean | undefined;
    /**
     * The date since this member boosted the guild, if applicable.
     */
    get premiumSince(): IfPartial<IsPartial, string | null>;
    /**
     * The flags of the member.
     * @see https://discord.com/developers/docs/resources/guild#guild-member-object-guild-member-flags
     */
    get flags(): IfPartial<IsPartial, GuildMemberFlags>;
    /**
     * The roles of the member
     */
    get roles(): IfPartial<IsPartial, Role<true>[]>;
    /**
     * The joined date of the member
     */
    get joinedAt(): IfPartial<IsPartial, string | null>;
    /**
     * The date when the member's communication privileges (timeout) will be reinstated
     */
    get communicationDisabledUntil(): IfPartial<IsPartial, string | null>;
    /**
     * Is this member yet to pass the guild's Membership Screening requirements?
     */
    get pending(): IfPartial<IsPartial, boolean>;
    getVoiceState(): Promise<VoiceState | null>;
    getPermissions(): Promise<IfPartial<IsPartial, bigint[]>>;
    /**
     * Set the nickname of the member
     */
    setNickname(nickname: string | null, reason?: string): Promise<void>;
    /**
     * Set the member's guild-specific data
     * This will only work if the current member is the bot itself, and will throw an error if it is not
     */
    setMemberData(data: {
        /**
         * Data URI base64 encoded banner image
         */
        banner?: string | null;
        bio?: string | null;
        /**
         * Data URI base64 encoded avatar image
         */
        avatar?: string | null;
    }, reason?: string): Promise<void>;
    /**
     * Add a role to the member
     */
    addRole(roleId: string, reason?: string): Promise<void>;
    /**
     * Remove a role from the member
     */
    removeRole(roleId: string, reason?: string): Promise<void>;
    /**
     * Kick the member from the guild
     */
    kick(reason?: string): Promise<void>;
    /**
     * Ban the member from the guild
     */
    ban(options?: {
        reason?: string;
        deleteMessageDays?: number;
    }): Promise<void>;
    /**
     * Mute a member in voice channels
     */
    muteMember(reason?: string): Promise<void>;
    /**
     * Unmute a member in voice channels
     */
    unmuteMember(reason?: string): Promise<void>;
    /**
     * Deafen a member in voice channels
     */
    deafenMember(reason?: string): Promise<void>;
    /**
     * Undeafen a member in voice channels
     */
    undeafenMember(reason?: string): Promise<void>;
    /**
     * Set or remove a timeout for a member in the guild
     */
    timeoutMember(communicationDisabledUntil: string, reason?: string): Promise<void>;
    fetch(): Promise<GuildMember<false, true>>;
}
export {};
//# sourceMappingURL=GuildMember.d.ts.map