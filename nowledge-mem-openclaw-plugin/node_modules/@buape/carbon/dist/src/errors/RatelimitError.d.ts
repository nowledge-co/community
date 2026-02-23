import { DiscordError } from "./DiscordError.js";
/**
 * A RateLimitError is thrown when the bot is rate limited by Discord, and you don't have requests set to queue.
 */
export declare class RateLimitError extends DiscordError {
    retryAfter: number;
    scope: "global" | "shared" | "user";
    bucket: string | null;
    constructor(response: Response, body: {
        message: string;
        retry_after: number;
        global: boolean;
    });
}
//# sourceMappingURL=RatelimitError.d.ts.map