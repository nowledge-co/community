import { Routes } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import { buildCDNUrl, serializePayload } from "../utils/index.js";
import { Message } from "./Message.js";
export class User extends Base {
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
    // private setField(key: keyof APIUser, value: unknown) {
    // 	if (!this.rawData) throw new Error("Cannot set field without having data... smh")
    // 	Reflect.set(this.rawData, key, value)
    // }
    /**
     * The raw Discord API data for this user
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial User. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The ID of the user
     */
    id;
    /**
     * Whether the user is a partial user (meaning it does not have all the data).
     * If this is true, you should use {@link User.fetch} to get the full data of the user.
     */
    get partial() {
        return (this._rawData === null);
    }
    /**
     * The username of the user.
     */
    get username() {
        if (!this._rawData)
            return undefined;
        return this._rawData.username;
    }
    /**
     * The global name of the user.
     */
    get globalName() {
        if (!this._rawData)
            return undefined;
        return this._rawData.global_name;
    }
    /**
     * The discriminator of the user.
     */
    get discriminator() {
        if (!this._rawData)
            return undefined;
        return this._rawData.discriminator;
    }
    /**
     * Is this user a bot?
     */
    get bot() {
        if (!this._rawData)
            return undefined;
        return this._rawData.bot ?? false;
    }
    /**
     * Is this user a system user?
     */
    get system() {
        if (!this._rawData)
            return undefined;
        return this._rawData.system ?? false;
    }
    /**
     * The public flags of the user. (Bitfield)
     * @see https://discord.com/developers/docs/resources/user#user-object-user-flags
     */
    get flags() {
        if (!this._rawData)
            return undefined;
        return this._rawData.public_flags;
    }
    /**
     * The avatar hash of the user.
     * You can use {@link User.avatarUrl} to get the URL of the avatar.
     */
    get avatar() {
        if (!this._rawData)
            return undefined;
        return this._rawData.avatar;
    }
    /**
     * Get the URL of the user's avatar with default settings (png format)
     */
    get avatarUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/avatars/${this.id}`, this.avatar);
    }
    /**
     * Get the URL of the user's avatar with custom format and size options
     * @param options Optional format and size parameters
     * @returns The avatar URL or null if no avatar is set
     */
    getAvatarUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/avatars/${this.id}`, this.avatar, options);
    }
    /**
     * The banner hash of the user.
     * You can use {@link User.bannerUrl} to get the URL of the banner.
     */
    get banner() {
        if (!this._rawData)
            return undefined;
        return this._rawData.banner ?? null;
    }
    /**
     * Get the URL of the user's banner with default settings (png format)
     */
    get bannerUrl() {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/banners/${this.id}`, this.banner);
    }
    /**
     * Get the URL of the user's banner with custom format and size options
     * @param options Optional format and size parameters
     * @returns The banner URL or null if no banner is set
     */
    getBannerUrl(options) {
        if (!this._rawData)
            return undefined;
        return buildCDNUrl(`https://cdn.discordapp.com/banners/${this.id}`, this.banner, options);
    }
    /**
     * The accent color of the user.
     */
    get accentColor() {
        if (!this._rawData)
            return undefined;
        return this._rawData.accent_color ?? null;
    }
    /**
     * Returns the Discord mention format for this user
     * @returns The mention string in the format <@userId>
     */
    toString() {
        return `<@${this.id}>`;
    }
    /**
     * Fetch updated data for this user.
     * If the user is partial, this will fetch all the data for the user and populate the fields.
     * If the user is not partial, all fields will be updated with new values from Discord.
     * @returns A Promise that resolves to a non-partial User
     */
    async fetch() {
        const newData = (await this.client.rest.get(Routes.user(this.id)));
        if (!newData)
            throw new Error(`User ${this.id} not found`);
        this.setData(newData);
        return this;
    }
    /**
     * Instantiate a new DM channel with this user.
     */
    async createDm() {
        const dmChannel = (await this.client.rest.post(Routes.userChannels(), {
            body: {
                recipient_id: this.id
            }
        }));
        return dmChannel;
    }
    /**
     * Send a message to this user.
     */
    async send(data) {
        const dmChannel = await this.createDm();
        const message = (await this.client.rest.post(Routes.channelMessages(dmChannel.id), {
            body: serializePayload(data)
        }));
        return new Message(this.client, message);
    }
}
//# sourceMappingURL=User.js.map