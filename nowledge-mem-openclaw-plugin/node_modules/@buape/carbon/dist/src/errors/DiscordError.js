import { errorMapper } from "../functions/errorsMapper.js";
import { BaseError } from "./BaseError.js";
export class DiscordError extends BaseError {
    /**
     * The HTTP status code of the response from Discord
     * @see https://discord.com/developers/docs/topics/opcodes-and-status-codes#http
     */
    status;
    /**
     * The Discord error code
     * @see https://discord.com/developers/docs/topics/opcodes-and-status-codes#json
     */
    discordCode;
    /**
     * An array of the errors that were returned by Discord
     */
    errors;
    /**
     * The raw body of the error from Discord
     * @internal
     */
    rawBody;
    constructor(response, body) {
        super(body.message);
        this.rawBody = body;
        this.status = response.status;
        this.discordCode = body.code;
        this.errors = errorMapper(body);
    }
}
//# sourceMappingURL=DiscordError.js.map