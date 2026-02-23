import { type APIDMChannel, type APIUser, type UserFlags } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import type { IfPartial, MessagePayload } from "../types/index.js";
import { type CDNUrlOptions } from "../utils/index.js";
import { Message } from "./Message.js";
export declare class User<IsPartial extends boolean = false> extends Base {
    constructor(client: Client, rawDataOrId: IsPartial extends true ? string : APIUser);
    protected _rawData: APIUser | null;
    private setData;
    /**
     * The raw Discord API data for this user
     */
    get rawData(): Readonly<APIUser>;
    /**
     * The ID of the user
     */
    readonly id: string;
    /**
     * Whether the user is a partial user (meaning it does not have all the data).
     * If this is true, you should use {@link User.fetch} to get the full data of the user.
     */
    get partial(): IsPartial;
    /**
     * The username of the user.
     */
    get username(): IfPartial<IsPartial, string>;
    /**
     * The global name of the user.
     */
    get globalName(): IfPartial<IsPartial, string | null>;
    /**
     * The discriminator of the user.
     */
    get discriminator(): IfPartial<IsPartial, string>;
    /**
     * Is this user a bot?
     */
    get bot(): IfPartial<IsPartial, boolean>;
    /**
     * Is this user a system user?
     */
    get system(): IfPartial<IsPartial, boolean>;
    /**
     * The public flags of the user. (Bitfield)
     * @see https://discord.com/developers/docs/resources/user#user-object-user-flags
     */
    get flags(): IfPartial<IsPartial, UserFlags | undefined>;
    /**
     * The avatar hash of the user.
     * You can use {@link User.avatarUrl} to get the URL of the avatar.
     */
    get avatar(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the user's avatar with default settings (png format)
     */
    get avatarUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the user's avatar with custom format and size options
     * @param options Optional format and size parameters
     * @returns The avatar URL or null if no avatar is set
     */
    getAvatarUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * The banner hash of the user.
     * You can use {@link User.bannerUrl} to get the URL of the banner.
     */
    get banner(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the user's banner with default settings (png format)
     */
    get bannerUrl(): IfPartial<IsPartial, string | null>;
    /**
     * Get the URL of the user's banner with custom format and size options
     * @param options Optional format and size parameters
     * @returns The banner URL or null if no banner is set
     */
    getBannerUrl(options?: CDNUrlOptions): IfPartial<IsPartial, string | null>;
    /**
     * The accent color of the user.
     */
    get accentColor(): IfPartial<IsPartial, number | null>;
    /**
     * Returns the Discord mention format for this user
     * @returns The mention string in the format <@userId>
     */
    toString(): string;
    /**
     * Fetch updated data for this user.
     * If the user is partial, this will fetch all the data for the user and populate the fields.
     * If the user is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial User
     */
    fetch(): Promise<User<false>>;
    /**
     * Instantiate a new DM channel with this user.
     */
    createDm(): Promise<APIDMChannel>;
    /**
     * Send a message to this user.
     */
    send(data: MessagePayload): Promise<Message<false>>;
}
//# sourceMappingURL=User.d.ts.map