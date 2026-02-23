import { Routes } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { DiscordError } from "../errors/DiscordError.js";
import { channelFactory } from "../functions/channelFactory.js";
import { buildCDNUrl } from "../utils/index.js";
import { GuildEmoji } from "./Emoji.js";
import { GuildMember } from "./GuildMember.js";
import { GuildScheduledEvent } from "./GuildScheduledEvent.js";
import { Role } from "./Role.js";
export class Guild extends Base {
    constructor(client, rawDataOrId) {
        super(client);
        if (typeof rawDataOrId === "string") {
            this.id = rawDataOrId;
        }
        else {
            this._rawData = rawDataOrId;
            this.id = rawDataOrId.id;
            this.setData(rawDataOrId);
        }
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
     * The raw Discord API data for this guild
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial Guild. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The ID of the guild
     */
    id;
    /**
     * Whether the guild is a partial guild (meaning it does not have all the data).
     * If this is true, you should use {@link Guild.fetch} to get the full data of the guild.
     */
    get partial() {
        return (this._rawData === null);
    }
    /**
     * The name of the guild.
     */
    get name() {
        if (!this._rawData)
            return undefined;
        return this._rawData.name;
    }
    /**
     * The description of the guild.
     */
    get description() {
        if (!this._rawData)
            return undefined;
        return this._rawData.description;
    }
    /**
     * The icon hash of the guild.
     * You can use {@link Guild.iconUrl} to get the URL of the icon.
     */
    get icon() {
        if (!this._rawData)
            return undefined;
        return this._rawData.icon;
    }
    /**
     * Get the URL of the guild's icon with default settings (png format)
     */
    get iconUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/icons/${this.id}`, this.icon);
    }
    /**
     * Get the URL of the guild's icon with custom format and size options
     * @param options Optional format and size parameters
     * @returns The icon URL or null if no icon is set
     */
    getIconUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/icons/${this.id}`, this.icon, options);
    }
    /**
     * The splash hash of the guild.
     * You can use {@link Guild.splashUrl} to get the URL of the splash.
     */
    get splash() {
        if (!this._rawData)
            return undefined;
        return this._rawData.splash;
    }
    /**
     * Get the URL of the guild's splash with default settings (png format)
     */
    get splashUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/splashes/${this.id}`, this.splash);
    }
    /**
     * Get the URL of the guild's splash with custom format and size options
     * @param options Optional format and size parameters
     * @returns The splash URL or null if no splash is set
     */
    getSplashUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/splashes/${this.id}`, this.splash, options);
    }
    /**
     * The ID of the owner of the guild.
     */
    get ownerId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.owner_id;
    }
    /**
     * Get all roles in the guild
     */
    get roles() {
        if (!this._rawData)
            return undefined;
        const roles = this._rawData?.roles;
        if (!roles)
            throw new Error("Cannot get roles without having data... smh");
        return roles.map((role) => new Role(this.client, role, this.id));
    }
    /**
     * The preferred locale of the guild.
     */
    get preferredLocale() {
        if (!this._rawData)
            return undefined;
        return this._rawData.preferred_locale;
    }
    /**
     * The discovery splash hash of the guild.
     * You can use {@link Guild.discoverySplashUrl} to get the URL of the discovery splash.
     */
    get discoverySplash() {
        if (!this._rawData)
            return undefined;
        return this._rawData.discovery_splash;
    }
    /**
     * Get the URL of the guild's discovery splash with default settings (png format)
     */
    get discoverySplashUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/discovery-splashes/${this.id}`, this.discoverySplash);
    }
    /**
     * Get the URL of the guild's discovery splash with custom format and size options
     * @param options Optional format and size parameters
     * @returns The discovery splash URL or null if no discovery splash is set
     */
    getDiscoverySplashUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/discovery-splashes/${this.id}`, this.discoverySplash, options);
    }
    /**
     * Whether the user is the owner of the guild
     */
    get owner() {
        if (!this._rawData)
            return undefined;
        return this._rawData.owner ?? false;
    }
    /**
     * Total permissions for the user in the guild (excludes overrides)
     */
    get permissions() {
        if (!this._rawData)
            return undefined;
        return this._rawData.permissions;
    }
    /**
     * ID of afk channel
     */
    get afkChannelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.afk_channel_id;
    }
    /**
     * afk timeout in seconds, can be set to: `60`, `300`, `900`, `1800`, `3600`
     */
    get afkTimeout() {
        if (!this._rawData)
            return undefined;
        return this._rawData.afk_timeout;
    }
    /**
     * Whether the guild widget is enabled
     */
    get widgetEnabled() {
        if (!this._rawData)
            return undefined;
        return this._rawData.widget_enabled ?? false;
    }
    /**
     * The channel id that the widget will generate an invite to, or `null` if set to no invite
     */
    get widgetChannelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.widget_channel_id ?? null;
    }
    /**
     * Verification level required for the guild
     */
    get verificationLevel() {
        if (!this._rawData)
            return undefined;
        return this._rawData.verification_level;
    }
    /**
     * Default message notifications level
     */
    get defaultMessageNotifications() {
        if (!this._rawData)
            return undefined;
        return this._rawData.default_message_notifications;
    }
    /**
     * Explicit content filter level
     */
    get explicitContentFilter() {
        if (!this._rawData)
            return undefined;
        return this._rawData.explicit_content_filter;
    }
    /**
     * Custom guild emojis
     */
    get emojis() {
        if (!this._rawData)
            return undefined;
        return this._rawData.emojis.map((emoji) => new GuildEmoji(this.client, emoji, this.id));
    }
    /**
     * Enabled guild features
     */
    get features() {
        if (!this._rawData)
            return undefined;
        return this._rawData.features;
    }
    /**
     * Required MFA level for the guild
     */
    get mfaLevel() {
        if (!this._rawData)
            return undefined;
        return this._rawData.mfa_level;
    }
    /**
     * Application id of the guild creator if it is bot-created
     */
    get applicationId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.application_id;
    }
    /**
     * The id of the channel where guild notices such as welcome messages and boost events are posted
     */
    get systemChannelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.system_channel_id;
    }
    /**
     * System channel flags
     */
    get systemChannelFlags() {
        if (!this._rawData)
            return undefined;
        return this._rawData.system_channel_flags;
    }
    /**
     * The id of the channel where Community guilds can display rules and/or guidelines
     */
    get rulesChannelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.rules_channel_id;
    }
    /**
     * The maximum number of presences for the guild (`null` is always returned, apart from the largest of guilds)
     */
    get maxPresences() {
        if (!this._rawData)
            return undefined;
        return this._rawData.max_presences ?? null;
    }
    /**
     * The maximum number of members for the guild
     */
    get maxMembers() {
        if (!this._rawData)
            return undefined;
        return this._rawData.max_members ?? 0;
    }
    /**
     * The vanity url code for the guild
     */
    get vanityUrlCode() {
        if (!this._rawData)
            return undefined;
        return this._rawData.vanity_url_code;
    }
    /**
     * Banner hash
     * You can use {@link Guild.bannerUrl} to get the URL of the banner.
     */
    get banner() {
        if (!this._rawData)
            return undefined;
        return this._rawData.banner;
    }
    /**
     * Get the URL of the guild's banner with default settings (png format)
     */
    get bannerUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/banners/${this.id}`, this.banner);
    }
    /**
     * Get the URL of the guild's banner with custom format and size options
     * @param options Optional format and size parameters
     * @returns The banner URL or null if no banner is set
     */
    getBannerUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/banners/${this.id}`, this.banner, options);
    }
    /**
     * Premium tier (Server Boost level)
     */
    get premiumTier() {
        if (!this._rawData)
            return undefined;
        return this._rawData.premium_tier;
    }
    /**
     * The number of boosts this guild currently has
     */
    get premiumSubscriptionCount() {
        if (!this._rawData)
            return undefined;
        return this._rawData.premium_subscription_count ?? 0;
    }
    /**
     * The id of the channel where admins and moderators of Community guilds receive notices from Discord
     */
    get publicUpdatesChannelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.public_updates_channel_id;
    }
    /**
     * The maximum amount of users in a video channel
     */
    get maxVideoChannelUsers() {
        if (!this._rawData)
            return undefined;
        return this._rawData.max_video_channel_users ?? 0;
    }
    /**
     * The maximum amount of users in a stage video channel
     */
    get maxStageVideoChannelUsers() {
        if (!this._rawData)
            return undefined;
        return this._rawData.max_stage_video_channel_users ?? 0;
    }
    /**
     * Approximate number of members in this guild
     */
    get approximateMemberCount() {
        if (!this._rawData)
            return undefined;
        return this._rawData.approximate_member_count ?? 0;
    }
    /**
     * Approximate number of non-offline members in this guild
     */
    get approximatePresenceCount() {
        if (!this._rawData)
            return undefined;
        return this._rawData.approximate_presence_count ?? 0;
    }
    /**
     * The welcome screen of a Community guild, shown to new members
     */
    get welcomeScreen() {
        if (!this._rawData)
            return undefined;
        return this._rawData.welcome_screen;
    }
    /**
     * The nsfw level of the guild
     */
    get nsfwLevel() {
        if (!this._rawData)
            return undefined;
        return this._rawData.nsfw_level;
    }
    /**
     * Custom guild stickers
     */
    get stickers() {
        if (!this._rawData)
            return undefined;
        return this._rawData.stickers;
    }
    /**
     * Whether the guild has the boost progress bar enabled
     */
    get premiumProgressBarEnabled() {
        if (!this._rawData)
            return undefined;
        return this._rawData.premium_progress_bar_enabled;
    }
    /**
     * The type of Student Hub the guild is
     */
    get hubType() {
        if (!this._rawData)
            return undefined;
        return this._rawData.hub_type;
    }
    /**
     * The id of the channel where admins and moderators of Community guilds receive safety alerts from Discord
     */
    get safetyAlertsChannelId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.safety_alerts_channel_id;
    }
    /**
     * The incidents data for this guild
     */
    get incidentsData() {
        if (!this._rawData)
            return undefined;
        return this._rawData.incidents_data;
    }
    /**
     * Fetch updated data for this guild.
     * If the guild is partial, this will fetch all the data for the guild and populate the fields.
     * If the guild is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial Guild
     */
    async fetch() {
        const newData = (await this.client.rest.get(Routes.guild(this.id)));
        if (!newData)
            throw new Error(`Guild ${this.id} not found`);
        this.setData(newData);
        return this;
    }
    /**
     * Leave the guild
     */
    async leave() {
        await this.client.rest.delete(Routes.guild(this.id));
    }
    /**
     * Create a role in the guild
     */
    async createRole(data) {
        const role = (await this.client.rest.post(Routes.guildRoles(this.id), {
            body: {
                ...data
            }
        }));
        const roleClass = new Role(this.client, role, this.id);
        this.setField("roles", Array.isArray(this.roles) ? [...this.roles, roleClass] : [roleClass]);
        return roleClass;
    }
    /**
     * Get a member in the guild by ID
     * @param memberId The ID of the member to fetch
     * @returns A Promise that resolves to a GuildMember or null if not found
     */
    async fetchMember(memberId) {
        try {
            const partialGuild = new Guild(this.client, this.id);
            const member = (await this.client.rest.get(Routes.guildMember(this.id, memberId)));
            const memberObject = new GuildMember(this.client, member, partialGuild);
            return memberObject;
        }
        catch (e) {
            if (e instanceof DiscordError) {
                if (e.status === 404)
                    return null;
            }
            throw e;
        }
    }
    /**
     * Fetch all members in the guild
     * @param limit The maximum number of members to fetch (max 1000, default 100, set to "all" to fetch all members)
     * @returns A Promise that resolves to an array of GuildMember objects
     * @experimental
     */
    async fetchMembers(limit = 100) {
        if (limit === "all") {
            const members = [];
            let after;
            let hasMore = true;
            while (hasMore) {
                const newMembers = (await this.client.rest.get(Routes.guildMembers(this.id), {
                    limit: "1000",
                    ...(after ? { after } : {})
                }));
                if (newMembers.length === 0) {
                    hasMore = false;
                }
                else {
                    members.push(...newMembers);
                    after = newMembers[newMembers.length - 1]?.user.id;
                }
            }
            const memberObjects = members.map((member) => new GuildMember(this.client, member, this));
            return memberObjects;
        }
        const cappedLimit = Math.min(limit, 1000);
        const members = (await this.client.rest.get(Routes.guildMembers(this.id), {
            limit: cappedLimit.toString()
        }));
        const memberObjects = members.map((member) => new GuildMember(this.client, member, this));
        return memberObjects;
    }
    /**
     * Fetch a channel from the guild by ID
     */
    async fetchChannel(channelId) {
        try {
            const channel = (await this.client.rest.get(Routes.channel(channelId)));
            return channelFactory(this.client, channel);
        }
        catch (e) {
            if (e instanceof DiscordError) {
                if (e.status === 404)
                    return null;
            }
            throw e;
        }
    }
    /**
     * Fetch all channels in the guild
     * @returns A Promise that resolves to an array of channel objects
     */
    async fetchChannels() {
        const channels = (await this.client.rest.get(Routes.guildChannels(this.id)));
        const channelObjects = channels.map((channel) => channelFactory(this.client, channel));
        return channelObjects;
    }
    /**
     * Fetch a role from the guild by ID
     */
    async fetchRole(roleId) {
        const role = (await this.client.rest.get(Routes.guildRole(this.id, roleId)));
        return new Role(this.client, role, this.id);
    }
    /**
     * Fetch all roles in the guild
     * @returns A Promise that resolves to an array of Role objects
     */
    async fetchRoles() {
        const roles = (await this.client.rest.get(Routes.guildRoles(this.id)));
        const roleObjects = roles.map((role) => new Role(this.client, role, this.id));
        return roleObjects;
    }
    async getEmoji(id) {
        const emoji = (await this.client.rest.get(Routes.guildEmoji(this.id, id)));
        return new GuildEmoji(this.client, emoji, this.id);
    }
    getEmojiByName(name) {
        const emojis = this.emojis;
        return emojis?.find((emoji) => emoji.name === name);
    }
    /**
     * Upload a new emoji to the application
     * @param name The name of the emoji
     * @param image The image of the emoji in base64 format
     * @returns The created ApplicationEmoji
     */
    async createEmoji(name, image) {
        const emoji = (await this.client.rest.post(Routes.guildEmojis(this.id), {
            body: { name, image }
        }));
        return new GuildEmoji(this.client, emoji, this.id);
    }
    async deleteEmoji(id) {
        await this.client.rest.delete(Routes.guildEmoji(this.id, id));
    }
    /**
     * Fetch all scheduled events for the guild
     * @param withUserCount Whether to include the user count in the response
     * @returns A Promise that resolves to an array of GuildScheduledEvent objects
     */
    async fetchScheduledEvents(withUserCount = false) {
        const scheduledEvents = (await this.client.rest.get(Routes.guildScheduledEvents(this.id), withUserCount ? { with_user_count: "true" } : undefined));
        return scheduledEvents.map((event) => new GuildScheduledEvent(this.client, event, this.id));
    }
    /**
     * Fetch a specific scheduled event by ID
     * @param eventId The ID of the scheduled event to fetch
     * @param withUserCount Whether to include the user count in the response
     * @returns A Promise that resolves to a GuildScheduledEvent or null if not found
     */
    async fetchScheduledEvent(eventId, withUserCount = false) {
        try {
            const scheduledEvent = (await this.client.rest.get(Routes.guildScheduledEvent(this.id, eventId), withUserCount ? { with_user_count: "true" } : undefined));
            return new GuildScheduledEvent(this.client, scheduledEvent, this.id);
        }
        catch (e) {
            if (e instanceof DiscordError) {
                if (e.status === 404)
                    return null;
            }
            throw e;
        }
    }
    /**
     * Create a new scheduled event
     * @param data The data for the scheduled event
     * @returns A Promise that resolves to the created GuildScheduledEvent
     */
    async createScheduledEvent(data) {
        const scheduledEvent = (await this.client.rest.post(Routes.guildScheduledEvents(this.id), {
            body: {
                name: data.name,
                description: data.description ?? null,
                scheduled_start_time: data.scheduledStartTime,
                scheduled_end_time: data.scheduledEndTime ?? null,
                privacy_level: data.privacyLevel,
                entity_type: data.entityType,
                channel_id: data.channelId ?? null,
                entity_metadata: data.entityMetadata,
                image: data.image ?? null
            }
        }));
        return new GuildScheduledEvent(this.client, scheduledEvent, this.id);
    }
    /**
     * Edit a scheduled event
     * @param eventId The ID of the scheduled event to edit
     * @param data The data to update the scheduled event with
     * @returns A Promise that resolves to the updated GuildScheduledEvent
     */
    async editScheduledEvent(eventId, data) {
        const body = {};
        if (data.name !== undefined)
            body.name = data.name;
        if (data.description !== undefined)
            body.description = data.description;
        if (data.scheduledStartTime !== undefined)
            body.scheduled_start_time = data.scheduledStartTime;
        if (data.scheduledEndTime !== undefined)
            body.scheduled_end_time = data.scheduledEndTime;
        if (data.privacyLevel !== undefined)
            body.privacy_level = data.privacyLevel;
        if (data.entityType !== undefined)
            body.entity_type = data.entityType;
        if (data.channelId !== undefined)
            body.channel_id = data.channelId;
        if (data.entityMetadata !== undefined)
            body.entity_metadata = data.entityMetadata;
        if (data.image !== undefined)
            body.image = data.image;
        const scheduledEvent = (await this.client.rest.patch(Routes.guildScheduledEvent(this.id, eventId), { body }));
        return new GuildScheduledEvent(this.client, scheduledEvent, this.id);
    }
    /**
     * Delete a scheduled event
     * @param eventId The ID of the scheduled event to delete
     */
    async deleteScheduledEvent(eventId) {
        await this.client.rest.delete(Routes.guildScheduledEvent(this.id, eventId));
    }
    /**
     * Get member counts for each role in the guild
     * @returns A Promise that resolves to an array of objects containing role ID, partial Role, and member count
     */
    async fetchRoleMemberCounts() {
        const memberCounts = (await this.client.rest.get(`/guilds/${this.id}/roles/member-counts`));
        return Object.entries(memberCounts).map(([roleId, count]) => ({
            id: roleId,
            role: new Role(this.client, roleId, this.id),
            count
        }));
    }
}
//# sourceMappingURL=Guild.js.map