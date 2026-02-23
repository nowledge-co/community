import { type APIChannel, type ChannelFlags, type ChannelType } from "discord-api-types/v10";
import type { Client } from "../classes/Client.js";
import type { IfPartial } from "../types/index.js";
import { Base } from "./Base.js";
export declare abstract class BaseChannel<Type extends ChannelType, IsPartial extends boolean = false> extends Base {
    constructor(client: Client, rawDataOrId: IsPartial extends true ? string : Extract<APIChannel, {
        type: Type;
    }>);
    /**
     * The raw data of the channel.
     */
    protected _rawData: Extract<APIChannel, {
        type: Type;
    }> | null;
    protected setData(data: Extract<APIChannel, {
        type: Type;
    }>): void;
    protected setField(field: keyof Extract<APIChannel, {
        type: Type;
    }>, value: unknown): void;
    /**
     * The raw Discord API data for this channel
     */
    get rawData(): Readonly<Extract<APIChannel, {
        type: Type;
    }>>;
    /**
     * The id of the channel.
     */
    readonly id: string;
    /**
     * Whether the channel is a partial channel (meaning it does not have all the data).
     * If this is true, you should use {@link BaseChannel.fetch} to get the full data of the channel.
     */
    get partial(): IsPartial;
    /**
     * The type of the channel.
     */
    get type(): IfPartial<IsPartial, Type>;
    /**
     * The flags of the channel in a bitfield.
     * @see https://discord.com/developers/docs/resources/channel#channel-object-channel-flags
     */
    get flags(): IfPartial<IsPartial, ChannelFlags | undefined>;
    /**
     * Fetches the channel from the API.
     * @returns A Promise that resolves to a non-partial channel
     */
    fetch(): Promise<BaseChannel<Type, false>>;
    /**
     * Delete the channel
     */
    delete(): Promise<void>;
    /**
     * Returns the Discord mention format for this channel
     * @returns The mention string in the format <#channelId>
     */
    toString(): string;
}
//# sourceMappingURL=BaseChannel.d.ts.map