import type { APIApplicationEmoji, APIEmoji } from "discord-api-types/v10";
import { Base } from "../abstracts/Base.js";
import type { Client } from "../classes/Client.js";
import { type CDNUrlOptions } from "../utils/index.js";
import type { Role } from "./Role.js";
import { User } from "./User.js";
export declare abstract class BaseEmoji<T extends APIEmoji = APIEmoji> extends Base {
    protected _rawData: T;
    constructor(client: Client, rawData: T);
    /**
     * The ID of the emoji
     */
    get id(): string | null;
    /**
     * The name of the emoji
     */
    get name(): string | null;
    /**
     * The roles that can use the emoji
     */
    get roles(): string[] | undefined;
    /**
     * The user that created the emoji
     */
    get user(): User | undefined;
    /**
     * Whether the emoji requires colons
     */
    get requireColons(): boolean | undefined;
    /**
     * Whether the emoji is managed
     */
    get managed(): boolean | undefined;
    /**
     * Whether the emoji is animated
     */
    get animated(): boolean | undefined;
    /**
     * Whether the emoji is available (may be false due to loss of Server Boosts)
     */
    get available(): boolean | undefined;
    /**
     * Get the URL of the emoji with default settings (uses gif for animated, png otherwise)
     */
    get url(): string | null;
    /**
     * Get the URL of the emoji with custom format and size options
     * @param options Optional format and size parameters
     * @returns The emoji URL or null if no ID is set
     */
    getUrl(options?: CDNUrlOptions): string | null;
    toString(): string;
}
export declare class ApplicationEmoji extends BaseEmoji<APIApplicationEmoji> {
    readonly applicationId: string;
    constructor(client: Client, rawData: APIApplicationEmoji, applicationId: string);
    get rawData(): APIApplicationEmoji;
    private setData;
    setName(name: string): Promise<void>;
    delete(): Promise<void>;
}
export declare class GuildEmoji extends BaseEmoji {
    readonly guildId: string;
    constructor(client: Client, rawData: APIEmoji, guildId: string);
    get rawData(): APIEmoji;
    private setData;
    setName(name: string): Promise<void>;
    /**
     * Set the roles that can use the emoji
     * @param roles The roles to set
     */
    setRoles(roles: string[] | Role[]): Promise<void>;
    delete(): Promise<void>;
}
//# sourceMappingURL=Emoji.d.ts.map