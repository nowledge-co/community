import { DiscordError } from "./DiscordError.js";
/**
 * A RateLimitError is thrown when the bot is rate limited by Discord, and you don't have requests set to queue.
 */
export class RateLimitError extends DiscordError {
    retryAfter;
    scope;
    bucket;
    constructor(response, body) {
        super(response, body);
        if (this.status !== 429)
            throw new Error("Invalid status code for RateLimitError");
        this.retryAfter = body.retry_after;
        this.scope = response.headers.get("X-RateLimit-Scope");
        this.bucket = response.headers.get("X-RateLimit-Bucket");
    }
}
//# sourceMappingURL=RatelimitError.js.map