import { type APIGuildScheduledEvent, type GuildScheduledEventEntityType, type GuildScheduledEventPrivacyLevel, type GuildScheduledEventStatus, type RESTGetAPIGuildScheduledEventUsersQuery } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import type { IfPartial } from "../types/index.js";
import { Guild } from "./Guild.js";
import { User } from "./User.js";
export type GuildScheduledEventCreateData = {
    name: string;
    description?: string | null;
    scheduledStartTime: string;
    scheduledEndTime?: string | null;
    privacyLevel: GuildScheduledEventPrivacyLevel;
    entityType: GuildScheduledEventEntityType;
    channelId?: string | null;
    entityMetadata?: {
        location?: string | null | undefined;
    } | null;
    image?: string | null;
};
export declare class GuildScheduledEvent<IsPartial extends boolean = false> extends Base {
    constructor(client: Client, rawDataOrId: IsPartial extends true ? string : APIGuildScheduledEvent, guildId: string);
    protected _rawData: APIGuildScheduledEvent | null;
    private setData;
    /**
     * The raw Discord API data for this scheduled event
     */
    get rawData(): Readonly<APIGuildScheduledEvent>;
    /**
     * The ID of the scheduled event
     */
    readonly id: string;
    /**
     * The ID of the guild this scheduled event belongs to
     */
    readonly guildId: string;
    /**
     * Whether the scheduled event is a partial scheduled event (meaning it does not have all the data).
     * If this is true, you should use {@link GuildScheduledEvent.fetch} to get the full data of the scheduled event.
     */
    get partial(): IfPartial<IsPartial, false, true>;
    /**
     * The name of the scheduled event
     */
    get name(): IfPartial<IsPartial, string>;
    /**
     * The description of the scheduled event
     */
    get description(): IfPartial<IsPartial, string | null | undefined>;
    /**
     * The time the scheduled event will start
     */
    get scheduledStartTime(): IfPartial<IsPartial, string>;
    /**
     * The time the scheduled event will end, or null if the event does not have a scheduled end time
     */
    get scheduledEndTime(): IfPartial<IsPartial, string | null>;
    /**
     * The privacy level of the scheduled event
     */
    get privacyLevel(): IfPartial<IsPartial, GuildScheduledEventPrivacyLevel>;
    /**
     * The status of the scheduled event
     */
    get status(): IfPartial<IsPartial, GuildScheduledEventStatus>;
    /**
     * The type of the scheduled event
     */
    get entityType(): IfPartial<IsPartial, GuildScheduledEventEntityType>;
    /**
     * The ID of the channel where the scheduled event will be hosted, or null if entity_type is EXTERNAL
     */
    get channelId(): IfPartial<IsPartial, string | null>;
    /**
     * Additional metadata for the scheduled event
     */
    get entityMetadata(): IfPartial<IsPartial, APIGuildScheduledEvent["entity_metadata"]>;
    /**
     * The user that created the scheduled event
     */
    get creator(): IfPartial<IsPartial, User | null>;
    /**
     * The number of users subscribed to the scheduled event
     */
    get userCount(): IfPartial<IsPartial, number | undefined>;
    /**
     * The cover image hash of the scheduled event
     */
    get image(): IfPartial<IsPartial, string | null | undefined>;
    /**
     * Get the URL of the scheduled event's cover image
     */
    get imageUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Fetch updated data for this scheduled event.
     * If the scheduled event is partial, this will fetch all the data for the scheduled event and populate the fields.
     * If the scheduled event is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial GuildScheduledEvent
     */
    fetch(): Promise<GuildScheduledEvent<false>>;
    /**
     * Edit the scheduled event
     * @param data The data to update the scheduled event with
     * @returns A Promise that resolves to the updated scheduled event
     */
    edit(data: Partial<GuildScheduledEventCreateData>): Promise<GuildScheduledEvent<false>>;
    /**
     * Delete the scheduled event
     */
    delete(): Promise<void>;
    /**
     * Get the guild this scheduled event belongs to
     */
    getGuild(): Promise<Guild<false>>;
    /**
     * Fetch the users subscribed to this scheduled event
     * @param options The options for fetching the users
     * @returns A Promise that resolves to an array of Users
     */
    fetchUsers(options?: Omit<RESTGetAPIGuildScheduledEventUsersQuery, "with_member">): Promise<User<false>[]>;
}
//# sourceMappingURL=GuildScheduledEvent.d.ts.map