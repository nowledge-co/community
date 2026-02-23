import { type DiscordRawError, type TransformedError } from "../functions/errorsMapper.js";
import { BaseError } from "./BaseError.js";
export declare class DiscordError extends BaseError {
    /**
     * The HTTP status code of the response from Discord
     * @see https://discord.com/developers/docs/topics/opcodes-and-status-codes#http
     */
    status: number;
    /**
     * The Discord error code
     * @see https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
     */
    discordCode?: number;
    /**
     * An array of the errors that were returned by Discord
     */
    errors: TransformedError[];
    /**
     * The raw body of the error from Discord
     * @internal
     */
    rawBody: DiscordRawError;
    constructor(response: Response, body: DiscordRawError);
}
//# sourceMappingURL=DiscordError.d.ts.map