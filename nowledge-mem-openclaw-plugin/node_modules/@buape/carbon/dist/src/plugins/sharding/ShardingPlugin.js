import { Plugin } from "../../abstracts/Plugin.js";
import { GatewayPlugin } from "../gateway/GatewayPlugin.js";
export class ShardingPlugin extends Plugin {
    id = "sharding";
    client;
    shards = new Map();
    config;
    maxConcurrency;
    spawnQueue = [];
    spawning = false;
    gatewayInfo;
    customGatewayPlugin = GatewayPlugin;
    constructor(options) {
        super();
        this.config = options;
        this.maxConcurrency = options.maxConcurrency ?? 1;
    }
    get ping() {
        const pings = {};
        for (const [shardId, shard] of this.shards) {
            pings[shardId] = shard.ping;
        }
        return pings;
    }
    async registerClient(client) {
        this.client = client;
        // If totalShards not provided, get recommended amount from Discord
        if (!this.config.totalShards) {
            try {
                const response = await fetch("https://discord.com/api/v10/gateway/bot", {
                    headers: {
                        Authorization: `Bot ${client.options.token}`
                    }
                });
                const gatewayInfo = (await response.json());
                this.config.totalShards = gatewayInfo.shards;
                if (!this.config.url) {
                    this.config.url = gatewayInfo.url;
                }
                this.maxConcurrency = gatewayInfo.session_start_limit.max_concurrency;
                this.gatewayInfo = gatewayInfo;
            }
            catch {
                throw new Error("Failed to get recommended shard count from Discord");
            }
        }
        const totalShards = this.config.totalShards;
        if (!totalShards) {
            throw new Error("Total shards must be specified or retrievable from Discord");
        }
        // Determine which shards to spawn
        const shardsToSpawn = this.config.shardIds ?? Array.from({ length: totalShards }, (_, i) => i);
        // Queue all shards for spawning
        this.spawnQueue = [...shardsToSpawn];
        await this.processSpawnQueue();
    }
    async processSpawnQueue() {
        if (this.spawning || this.spawnQueue.length === 0)
            return;
        this.spawning = true;
        const currentBatch = [];
        // Process shards in batches based on maxConcurrency
        while (currentBatch.length < this.maxConcurrency &&
            this.spawnQueue.length > 0) {
            const shardId = this.spawnQueue.shift();
            if (shardId !== undefined) {
                currentBatch.push(shardId);
            }
        }
        const totalShards = this.config.totalShards;
        if (!totalShards)
            return;
        // Spawn the current batch of shards
        await Promise.all(currentBatch.map(async (shardId) => {
            const shard = new this.customGatewayPlugin({
                ...this.config,
                shard: [shardId, totalShards]
            }, this.gatewayInfo);
            if (this.client) {
                shard.registerClient(this.client);
            }
            this.shards.set(shardId, shard);
        }));
        this.spawning = false;
        // Continue processing if there are more shards to spawn
        if (this.spawnQueue.length > 0) {
            // Add a delay between batches to prevent rate limiting
            setTimeout(() => this.processSpawnQueue(), 5000);
        }
    }
    disconnect() {
        for (const shard of this.shards.values()) {
            shard.disconnect();
        }
        this.shards.clear();
        this.spawnQueue = [];
    }
    /**
     * Calculate which shard a guild belongs to
     */
    getShardForGuild(guildId) {
        const totalShards = this.config.totalShards;
        if (!totalShards) {
            return undefined;
        }
        const shardId = this.calculateShardId(guildId, totalShards);
        return this.shards.get(shardId);
    }
    /**
     * Discord's sharding formula
     */
    calculateShardId(guildId, totalShards) {
        if (!/^\d+$/.test(guildId)) {
            throw new Error("Invalid guild ID");
        }
        return Number((BigInt(guildId) >> 22n) % BigInt(totalShards));
    }
}
//# sourceMappingURL=ShardingPlugin.js.map