import { Base } from "../abstracts/Base.js";
import { Guild } from "./Guild.js";
import { GuildMember } from "./GuildMember.js";
import { User } from "./User.js";
export class ThreadMember extends Base {
    constructor(client, rawData, guildId) {
        super(client);
        this._rawData = rawData;
        this.setData(rawData);
        this.guildId = guildId;
    }
    _rawData = null;
    setData(data) {
        if (!data)
            throw new Error("Cannot set data without having data... smh");
        this._rawData = data;
    }
    /**
     * The raw Discord API data for this thread member
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial ThreadMember. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The ID of the guild. This is not present in the API response, so it must be provided.
     */
    guildId;
    /**
     * The ID of the thread
     */
    get id() {
        if (!this._rawData)
            return undefined;
        return this._rawData.id;
    }
    /**
     * The ID of the user
     */
    get userId() {
        if (!this._rawData)
            return undefined;
        return this._rawData.user_id;
    }
    get user() {
        if (!this.userId)
            return undefined;
        return new User(this.client, this.userId);
    }
    /**
     * The timestamp of when the user last joined the thread
     */
    get joinTimestamp() {
        if (!this._rawData)
            return undefined;
        return this._rawData.join_timestamp;
    }
    /**
     * 	Any user-thread settings, currently only used for notifications
     */
    get flags() {
        if (!this._rawData)
            return undefined;
        return this._rawData.flags;
    }
    /**
     * The member object of the user
     */
    member(guildId) {
        if (!this._rawData?.member || !this.user)
            return undefined;
        guildId = guildId ?? this.guildId;
        if (!guildId)
            throw new Error("Cannot create GuildMember without a guild ID");
        return new GuildMember(this.client, this._rawData.member, new Guild(this.client, guildId));
    }
}
//# sourceMappingURL=ThreadMember.js.map