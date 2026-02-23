export interface RateLimitConfig {
    /** Maximum number of events allowed in the time window */
    maxEvents: number;
    /** Time window in milliseconds */
    windowMs: number;
}
export declare class GatewayRateLimit {
    private events;
    private readonly config;
    constructor(config?: RateLimitConfig);
    /**
     * Check if sending an event would exceed the rate limit
     * @returns true if the event can be sent, false if rate limited
     */
    canSend(): boolean;
    /**
     * Record that an event was sent
     */
    recordEvent(): void;
    /**
     * Get the current number of events in the time window
     */
    getCurrentEventCount(): number;
    /**
     * Get remaining events before hitting rate limit
     */
    getRemainingEvents(): number;
    /**
     * Get time until rate limit resets (in milliseconds)
     */
    getResetTime(): number;
    /**
     * Remove events outside the current time window
     */
    private cleanupOldEvents;
    /**
     * Reset the rate limiter
     */
    reset(): void;
}
//# sourceMappingURL=rateLimit.d.ts.map