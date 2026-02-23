interface GuildCacheEntry {
    available: boolean;
    lastEvent: number;
}
export declare class BabyCache {
    guildCache: Map<string, GuildCacheEntry>;
    private readonly maxGuilds;
    private readonly ttl;
    constructor(maxGuilds?: number, ttl?: number);
    setGuild(guildId: string, entry: GuildCacheEntry): void;
    getGuild(guildId: string): GuildCacheEntry | undefined;
    removeGuild(guildId: string): boolean;
    cleanup(): number;
}
export {};
//# sourceMappingURL=BabyCache.d.ts.map