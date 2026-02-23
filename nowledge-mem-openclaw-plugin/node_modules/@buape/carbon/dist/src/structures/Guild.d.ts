import { type APIGuild, type APIGuildWelcomeScreen, type APIIncidentsData, type APISticker, type GuildDefaultMessageNotifications, type GuildExplicitContentFilter, type GuildFeature, type GuildHubType, type GuildMFALevel, type GuildNSFWLevel, type GuildPremiumTier, type GuildSystemChannelFlags, type GuildVerificationLevel, type RESTPostAPIGuildRoleJSONBody } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import { channelFactory } from "../functions/channelFactory.js";
import type { IfPartial } from "../types/index.js";
import { type CDNUrlOptions } from "../utils/index.js";
import { GuildEmoji } from "./Emoji.js";
import { GuildMember } from "./GuildMember.js";
import { GuildScheduledEvent, type GuildScheduledEventCreateData } from "./GuildScheduledEvent.js";
import { Role } from "./Role.js";
export declare class Guild<IsPartial extends boolean = false> extends Base {
    constructor(client: Client, rawDataOrId: IsPartial extends true ? string : APIGuild);
    protected _rawData: APIGuild | null;
    private setData;
    private setField;
    /**
     * The raw Discord API data for this guild
     */
    get rawData(): Readonly<APIGuild>;
    /**
     * The ID of the guild
     */
    readonly id: string;
    /**
     * Whether the guild is a partial guild (meaning it does not have all the data).
     * If this is true, you should use {@link Guild.fetch} to get the full data of the guild.
     */
    get partial(): IfPartial<IsPartial, false, true>;
    /**
     * The name of the guild.
     */
    get name(): IfPartial<IsPartial, string>;
    /**
     * The description of the guild.
     */
    get description(): IfPartial<IsPartial, string | null>;
    /**
     * The icon hash of the guild.
     * You can use {@link Guild.iconUrl} to get the URL of the icon.
     */
    get icon(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's icon with default settings (png format)
     */
    get iconUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's icon with custom format and size options
     * @param options Optional format and size parameters
     * @returns The icon URL or null if no icon is set
     */
    getIconUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * The splash hash of the guild.
     * You can use {@link Guild.splashUrl} to get the URL of the splash.
     */
    get splash(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's splash with default settings (png format)
     */
    get splashUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's splash with custom format and size options
     * @param options Optional format and size parameters
     * @returns The splash URL or null if no splash is set
     */
    getSplashUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * The ID of the owner of the guild.
     */
    get ownerId(): IfPartial<IsPartial, string>;
    /**
     * Get all roles in the guild
     */
    get roles(): IfPartial<IsPartial, Role[]>;
    /**
     * The preferred locale of the guild.
     */
    get preferredLocale(): IfPartial<IsPartial, string>;
    /**
     * The discovery splash hash of the guild.
     * You can use {@link Guild.discoverySplashUrl} to get the URL of the discovery splash.
     */
    get discoverySplash(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's discovery splash with default settings (png format)
     */
    get discoverySplashUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's discovery splash with custom format and size options
     * @param options Optional format and size parameters
     * @returns The discovery splash URL or null if no discovery splash is set
     */
    getDiscoverySplashUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * Whether the user is the owner of the guild
     */
    get owner(): IfPartial<IsPartial, boolean>;
    /**
     * Total permissions for the user in the guild (excludes overrides)
     */
    get permissions(): IfPartial<IsPartial, bigint>;
    /**
     * ID of afk channel
     */
    get afkChannelId(): IfPartial<IsPartial, string | null>;
    /**
     * afk timeout in seconds, can be set to: `60`, `300`, `900`, `1800`, `3600`
     */
    get afkTimeout(): IfPartial<IsPartial, 1800 | 3600 | 60 | 300 | 900>;
    /**
     * Whether the guild widget is enabled
     */
    get widgetEnabled(): IfPartial<IsPartial, boolean>;
    /**
     * The channel id that the widget will generate an invite to, or `null` if set to no invite
     */
    get widgetChannelId(): IfPartial<IsPartial, string | null>;
    /**
     * Verification level required for the guild
     */
    get verificationLevel(): IfPartial<IsPartial, GuildVerificationLevel>;
    /**
     * Default message notifications level
     */
    get defaultMessageNotifications(): IfPartial<IsPartial, GuildDefaultMessageNotifications>;
    /**
     * Explicit content filter level
     */
    get explicitContentFilter(): IfPartial<IsPartial, GuildExplicitContentFilter>;
    /**
     * Custom guild emojis
     */
    get emojis(): IfPartial<IsPartial, GuildEmoji[]>;
    /**
     * Enabled guild features
     */
    get features(): IfPartial<IsPartial, GuildFeature[]>;
    /**
     * Required MFA level for the guild
     */
    get mfaLevel(): IfPartial<IsPartial, GuildMFALevel>;
    /**
     * Application id of the guild creator if it is bot-created
     */
    get applicationId(): IfPartial<IsPartial, string | null>;
    /**
     * The id of the channel where guild notices such as welcome messages and boost events are posted
     */
    get systemChannelId(): IfPartial<IsPartial, string | null>;
    /**
     * System channel flags
     */
    get systemChannelFlags(): IfPartial<IsPartial, GuildSystemChannelFlags>;
    /**
     * The id of the channel where Community guilds can display rules and/or guidelines
     */
    get rulesChannelId(): IfPartial<IsPartial, string | null>;
    /**
     * The maximum number of presences for the guild (`null` is always returned, apart from the largest of guilds)
     */
    get maxPresences(): IfPartial<IsPartial, number | null>;
    /**
     * The maximum number of members for the guild
     */
    get maxMembers(): IfPartial<IsPartial, number>;
    /**
     * The vanity url code for the guild
     */
    get vanityUrlCode(): IfPartial<IsPartial, string | null>;
    /**
     * Banner hash
     * You can use {@link Guild.bannerUrl} to get the URL of the banner.
     */
    get banner(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's banner with default settings (png format)
     */
    get bannerUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the guild's banner with custom format and size options
     * @param options Optional format and size parameters
     * @returns The banner URL or null if no banner is set
     */
    getBannerUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * Premium tier (Server Boost level)
     */
    get premiumTier(): IfPartial<IsPartial, GuildPremiumTier>;
    /**
     * The number of boosts this guild currently has
     */
    get premiumSubscriptionCount(): IfPartial<IsPartial, number>;
    /**
     * The id of the channel where admins and moderators of Community guilds receive notices from Discord
     */
    get publicUpdatesChannelId(): IfPartial<IsPartial, string | null>;
    /**
     * The maximum amount of users in a video channel
     */
    get maxVideoChannelUsers(): IfPartial<IsPartial, number>;
    /**
     * The maximum amount of users in a stage video channel
     */
    get maxStageVideoChannelUsers(): IfPartial<IsPartial, number>;
    /**
     * Approximate number of members in this guild
     */
    get approximateMemberCount(): IfPartial<IsPartial, number>;
    /**
     * Approximate number of non-offline members in this guild
     */
    get approximatePresenceCount(): IfPartial<IsPartial, number>;
    /**
     * The welcome screen of a Community guild, shown to new members
     */
    get welcomeScreen(): IfPartial<IsPartial, APIGuildWelcomeScreen | undefined>;
    /**
     * The nsfw level of the guild
     */
    get nsfwLevel(): IfPartial<IsPartial, GuildNSFWLevel>;
    /**
     * Custom guild stickers
     */
    get stickers(): IfPartial<IsPartial, APISticker[]>;
    /**
     * Whether the guild has the boost progress bar enabled
     */
    get premiumProgressBarEnabled(): IfPartial<IsPartial, boolean>;
    /**
     * The type of Student Hub the guild is
     */
    get hubType(): IfPartial<IsPartial, GuildHubType | null>;
    /**
     * The id of the channel where admins and moderators of Community guilds receive safety alerts from Discord
     */
    get safetyAlertsChannelId(): IfPartial<IsPartial, string | null>;
    /**
     * The incidents data for this guild
     */
    get incidentsData(): IfPartial<IsPartial, APIIncidentsData | null>;
    /**
     * Fetch updated data for this guild.
     * If the guild is partial, this will fetch all the data for the guild and populate the fields.
     * If the guild is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial Guild
     */
    fetch(): Promise<Guild<false>>;
    /**
     * Leave the guild
     */
    leave(): Promise<void>;
    /**
     * Create a role in the guild
     */
    createRole(data: RESTPostAPIGuildRoleJSONBody): Promise<Role<false>>;
    /**
     * Get a member in the guild by ID
     * @param memberId The ID of the member to fetch
     * @returns A Promise that resolves to a GuildMember or null if not found
     */
    fetchMember(memberId: string): Promise<GuildMember<false, true> | null>;
    /**
     * Fetch all members in the guild
     * @param limit The maximum number of members to fetch (max 1000, default 100, set to "all" to fetch all members)
     * @returns A Promise that resolves to an array of GuildMember objects
     * @experimental
     */
    fetchMembers(limit?: number | "all"): Promise<GuildMember<false, IsPartial>[]>;
    /**
     * Fetch a channel from the guild by ID
     */
    fetchChannel(channelId: string): Promise<import("./DmChannel.js").DmChannel<false> | import("./GroupDmChannel.js").GroupDmChannel<false> | import("./GuildTextChannel.js").GuildTextChannel<false> | import("./GuildStageOrVoiceChannel.js").GuildVoiceChannel<false> | import("./GuildCategoryChannel.js").GuildCategoryChannel<false> | import("./GuildAnnouncementChannel.js").GuildAnnouncementChannel<false> | import("./GuildThreadChannel.js").GuildThreadChannel<import("discord-api-types/v10").ChannelType.AnnouncementThread | import("discord-api-types/v10").ChannelType.PublicThread | import("discord-api-types/v10").ChannelType.PrivateThread, false> | import("./GuildStageOrVoiceChannel.js").GuildStageChannel<false> | import("./GuildForumChannel.js").GuildForumChannel<false> | import("./GuildMediaChannel.js").GuildMediaChannel | null>;
    /**
     * Fetch all channels in the guild
     * @returns A Promise that resolves to an array of channel objects
     */
    fetchChannels(): Promise<ReturnType<typeof channelFactory>[]>;
    /**
     * Fetch a role from the guild by ID
     */
    fetchRole(roleId: string): Promise<Role<false>>;
    /**
     * Fetch all roles in the guild
     * @returns A Promise that resolves to an array of Role objects
     */
    fetchRoles(): Promise<Role[]>;
    getEmoji(id: string): Promise<GuildEmoji>;
    getEmojiByName(name: string): GuildEmoji | undefined;
    /**
     * Upload a new emoji to the application
     * @param name The name of the emoji
     * @param image The image of the emoji in base64 format
     * @returns The created ApplicationEmoji
     */
    createEmoji(name: string, image: string): Promise<GuildEmoji>;
    deleteEmoji(id: string): Promise<void>;
    /**
     * Fetch all scheduled events for the guild
     * @param withUserCount Whether to include the user count in the response
     * @returns A Promise that resolves to an array of GuildScheduledEvent objects
     */
    fetchScheduledEvents(withUserCount?: boolean): Promise<GuildScheduledEvent<false>[]>;
    /**
     * Fetch a specific scheduled event by ID
     * @param eventId The ID of the scheduled event to fetch
     * @param withUserCount Whether to include the user count in the response
     * @returns A Promise that resolves to a GuildScheduledEvent or null if not found
     */
    fetchScheduledEvent(eventId: string, withUserCount?: boolean): Promise<GuildScheduledEvent<false> | null>;
    /**
     * Create a new scheduled event
     * @param data The data for the scheduled event
     * @returns A Promise that resolves to the created GuildScheduledEvent
     */
    createScheduledEvent(data: GuildScheduledEventCreateData): Promise<GuildScheduledEvent<false>>;
    /**
     * Edit a scheduled event
     * @param eventId The ID of the scheduled event to edit
     * @param data The data to update the scheduled event with
     * @returns A Promise that resolves to the updated GuildScheduledEvent
     */
    editScheduledEvent(eventId: string, data: Partial<GuildScheduledEventCreateData>): Promise<GuildScheduledEvent<false>>;
    /**
     * Delete a scheduled event
     * @param eventId The ID of the scheduled event to delete
     */
    deleteScheduledEvent(eventId: string): Promise<void>;
    /**
     * Get member counts for each role in the guild
     * @returns A Promise that resolves to an array of objects containing role ID, partial Role, and member count
     */
    fetchRoleMemberCounts(): Promise<Array<{
        id: string;
        role: Role<true>;
        count: number;
    }>>;
}
//# sourceMappingURL=Guild.d.ts.map