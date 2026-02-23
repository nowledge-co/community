export class GatewayRateLimit {
    events = [];
    config;
    constructor(config = { maxEvents: 120, windowMs: 60000 }) {
        this.config = config;
    }
    /**
     * Check if sending an event would exceed the rate limit
     * @returns true if the event can be sent, false if rate limited
     */
    canSend() {
        this.cleanupOldEvents();
        return this.events.length < this.config.maxEvents;
    }
    /**
     * Record that an event was sent
     */
    recordEvent() {
        this.events.push(Date.now());
    }
    /**
     * Get the current number of events in the time window
     */
    getCurrentEventCount() {
        this.cleanupOldEvents();
        return this.events.length;
    }
    /**
     * Get remaining events before hitting rate limit
     */
    getRemainingEvents() {
        return Math.max(0, this.config.maxEvents - this.getCurrentEventCount());
    }
    /**
     * Get time until rate limit resets (in milliseconds)
     */
    getResetTime() {
        this.cleanupOldEvents();
        if (this.events.length === 0)
            return 0;
        const oldestEvent = this.events[0];
        if (!oldestEvent)
            return 0;
        return Math.max(0, this.config.windowMs - (Date.now() - oldestEvent));
    }
    /**
     * Remove events outside the current time window
     */
    cleanupOldEvents() {
        const now = Date.now();
        const cutoff = now - this.config.windowMs;
        this.events = this.events.filter((timestamp) => timestamp > cutoff);
    }
    /**
     * Reset the rate limiter
     */
    reset() {
        this.events = [];
    }
}
//# sourceMappingURL=rateLimit.js.map