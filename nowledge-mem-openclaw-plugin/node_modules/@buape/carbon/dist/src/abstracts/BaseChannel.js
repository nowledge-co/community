import { Routes } from "discord-api-types/v10";
import { Base } from "./Base.js";
export class BaseChannel extends Base {
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
    /**
     * The raw data of the channel.
     */
    _rawData = null;
    setData(data) {
        if (!data)
            throw new Error("Cannot set data without having data... smh");
        this._rawData = data;
    }
    setField(field, value) {
        if (!this._rawData)
            throw new Error("Cannot set field without having data... smh");
        this._rawData[field] = value;
    }
    /**
     * The raw Discord API data for this channel
     */
    get rawData() {
        if (!this._rawData)
            throw new Error("Cannot access rawData on partial Channel. Use fetch() to populate data.");
        return this._rawData;
    }
    /**
     * The id of the channel.
     */
    id;
    /**
     * Whether the channel is a partial channel (meaning it does not have all the data).
     * If this is true, you should use {@link BaseChannel.fetch} to get the full data of the channel.
     */
    get partial() {
        return (this._rawData === null);
    }
    /**
     * The type of the channel.
     */
    get type() {
        if (!this._rawData)
            return undefined;
        return this._rawData.type;
    }
    /**
     * The flags of the channel in a bitfield.
     * @see https://discord.com/developers/docs/resources/channel#channel-object-channel-flags
     */
    get flags() {
        if (!this._rawData)
            return undefined;
        return this._rawData.flags;
    }
    /**
     * Fetches the channel from the API.
     * @returns A Promise that resolves to a non-partial channel
     */
    async fetch() {
        const newData = (await this.client.rest.get(Routes.channel(this.id)));
        if (!newData)
            throw new Error(`Channel ${this.id} not found`);
        this.setData(newData);
        return this;
    }
    /**
     * Delete the channel
     */
    async delete() {
        await this.client.rest.delete(Routes.channel(this.id));
    }
    /**
     * Returns the Discord mention format for this channel
     * @returns The mention string in the format <#channelId>
     */
    toString() {
        return `<#${this.id}>`;
    }
}
//# sourceMappingURL=BaseChannel.js.map