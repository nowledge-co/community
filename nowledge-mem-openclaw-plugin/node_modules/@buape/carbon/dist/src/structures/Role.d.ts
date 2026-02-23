import { type APIRole, type APIRoleTags, type RoleFlags } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import type { IfPartial } from "../types/index.js";
import { type CDNUrlOptions } from "../utils/index.js";
export declare class Role<IsPartial extends boolean = false> extends Base {
    constructor(client: Client, rawDataOrId: IsPartial extends true ? string : APIRole, guildId?: string);
    protected _rawData: APIRole | null;
    private _guildId?;
    private setData;
    private setField;
    /**
     * The raw Discord API data for this role
     */
    get rawData(): Readonly<APIRole>;
    /**
     * The ID of the role.
     */
    readonly id: string;
    /**
     * The ID of the guild this role belongs to
     */
    get guildId(): string;
    /**
     * Whether the role is a partial role (meaning it does not have all the data).
     * If this is true, you should use {@link Role.fetch} to get the full data of the role.
     */
    get partial(): IsPartial;
    /**
     * The name of the role.
     */
    get name(): IfPartial<IsPartial, string>;
    /**
     * The color of the role.
     */
    get color(): IfPartial<IsPartial, number>;
    /**
     * The icon hash of the role.
     * You can use {@link Role.iconUrl} to get the URL of the icon.
     */
    get icon(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the role's icon with default settings (png format)
     */
    get iconUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the role's icon with custom format and size options
     * @param options Optional format and size parameters
     * @returns The icon URL or null if no icon is set
     */
    getIconUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * If this role is mentionable.
     */
    get mentionable(): IfPartial<IsPartial, boolean>;
    /**
     * If this role is hoisted.
     */
    get hoisted(): IfPartial<IsPartial, boolean>;
    /**
     * The position of the role.
     */
    get position(): IfPartial<IsPartial, number>;
    /**
     * The permissions of the role.
     */
    get permissions(): IfPartial<IsPartial, bigint>;
    /**
     * If this role is managed by an integration.
     */
    get managed(): IfPartial<IsPartial, boolean>;
    /**
     * The unicode emoji for the role.
     */
    get unicodeEmoji(): IfPartial<IsPartial, string | null>;
    /**
     * The flags of this role.
     * @see https://discord.com/developers/docs/topics/permissions#role-object-role-flags
     */
    get flags(): IfPartial<IsPartial, RoleFlags>;
    /**
     * The tags of this role.
     * @see https://discord.com/developers/docs/topics/permissions#role-object-role-tags-structure
     */
    get tags(): IfPartial<IsPartial, APIRoleTags | undefined>;
    /**
     * Returns the Discord mention format for this role
     * @returns The mention string in the format <@&roleId>
     */
    toString(): string;
    /**
     * Fetch updated data for this role.
     * If the role is partial, this will fetch all the data for the role and populate the fields.
     * If the role is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial Role
     */
    fetch(): Promise<Role<false>>;
    /**
     * Set the name of the role
     * @param name The new name for the role
     * @param reason The reason for changing the name (will be shown in audit log)
     */
    setName(name: string, reason?: string): Promise<void>;
    /**
     * Set the color of the role
     * @param color The new color for the role
     * @param reason The reason for changing the color (will be shown in audit log)
     */
    setColor(color: number, reason?: string): Promise<void>;
    /**
     * Set the icon of the role
     * @param icon The unicode emoji or icon URL to set
     * @param reason The reason for changing the icon (will be shown in audit log)
     */
    setIcon(icon: string, reason?: string): Promise<void>;
    /**
     * Set the mentionable status of the role
     * @param mentionable Whether the role should be mentionable
     * @param reason The reason for changing the mentionable status (will be shown in audit log)
     */
    setMentionable(mentionable: boolean, reason?: string): Promise<void>;
    /**
     * Set the hoisted status of the role
     * @param hoisted Whether the role should be hoisted
     * @param reason The reason for changing the hoisted status (will be shown in audit log)
     */
    setHoisted(hoisted: boolean, reason?: string): Promise<void>;
    /**
     * Set the position of the role
     * @param position The new position for the role
     * @param reason The reason for changing the position (will be shown in audit log)
     */
    setPosition(position: number, reason?: string): Promise<void>;
    /**
     * Set the permissions of the role
     * @param permissions The permissions to set
     * @param reason The reason for changing the permissions (will be shown in audit log)
     */
    setPermissions(permissions: bigint[], reason?: string): Promise<void>;
    /**
     * Delete the role
     * @param reason The reason for deleting the role (will be shown in audit log)
     */
    delete(reason?: string): Promise<void>;
    /**
     * Get the member count for this role
     * @returns A Promise that resolves to the number of members with this role
     */
    fetchMemberCount(): Promise<number>;
}
//# sourceMappingURL=Role.d.ts.map