import type { APIThreadMember, ThreadMemberFlags } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import { GuildMember } from "./GuildMember.js";
import { User } from "./User.js";
export declare class ThreadMember extends Base {
    constructor(client: Client, rawData: APIThreadMember, guildId?: string);
    protected _rawData: APIThreadMember | null;
    private setData;
    /**
     * The raw Discord API data for this thread member
     */
    get rawData(): Readonly<APIThreadMember>;
    /**
     * The ID of the guild. This is not present in the API response, so it must be provided.
     */
    guildId: string | undefined;
    /**
     * The ID of the thread
     */
    get id(): string | undefined;
    /**
     * The ID of the user
     */
    get userId(): string | undefined;
    get user(): User<true> | undefined;
    /**
     * The timestamp of when the user last joined the thread
     */
    get joinTimestamp(): string;
    /**
     * 	Any user-thread settings, currently only used for notifications
     */
    get flags(): ThreadMemberFlags;
    /**
     * The member object of the user
     */
    member(guildId?: string): GuildMember<false, true> | undefined;
}
//# sourceMappingURL=ThreadMember.d.ts.map