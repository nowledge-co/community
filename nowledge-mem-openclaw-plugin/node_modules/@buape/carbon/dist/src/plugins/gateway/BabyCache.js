// I called this the BabyCache because eventually, one way, carbon will have a more
// proper caching setup. For now, this is the toddler of that cache.
export class BabyCache {
    guildCache = new Map();
    maxGuilds;
    ttl;
    constructor(maxGuilds = 5000, ttl = 86400000) {
        this.maxGuilds = maxGuilds;
        this.ttl = ttl;
    }
    setGuild(guildId, entry) {
        if (this.guildCache.size >= this.maxGuilds &&
            !this.guildCache.has(guildId)) {
            let oldestId = null;
            let oldestTime = Number.POSITIVE_INFINITY;
            for (const [id, guild] of this.guildCache.entries()) {
                if (guild.lastEvent < oldestTime) {
                    oldestTime = guild.lastEvent;
                    oldestId = id;
                }
            }
            if (oldestId) {
                this.guildCache.delete(oldestId);
            }
        }
        this.guildCache.set(guildId, entry);
    }
    getGuild(guildId) {
        const entry = this.guildCache.get(guildId);
        if (!entry)
            return undefined;
        if (Date.now() - entry.lastEvent > this.ttl) {
            this.guildCache.delete(guildId);
            return undefined;
        }
        return entry;
    }
    removeGuild(guildId) {
        return this.guildCache.delete(guildId);
    }
    cleanup() {
        const now = Date.now();
        let removed = 0;
        for (const [id, entry] of this.guildCache.entries()) {
            if (now - entry.lastEvent > this.ttl) {
                this.guildCache.delete(id);
                removed++;
            }
        }
        return removed;
    }
}
//# sourceMappingURL=BabyCache.js.map