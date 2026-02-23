import type { APIGatewayBotInfo } from "discord-api-types/v10";
import { Plugin } from "../../abstracts/Plugin.js";
import type { Client } from "../../classes/Client.js";
import { GatewayPlugin } from "../gateway/GatewayPlugin.js";
import type { GatewayPluginOptions } from "../gateway/types.js";
export interface ShardingPluginOptions extends Omit<GatewayPluginOptions, "shard"> {
    /**
     * If not provided, will use Discord's recommended amount
     */
    totalShards?: number;
    /**
     * Specific shard IDs to spawn, if not provided will spawn all shards
     */
    shardIds?: number[];
    /**
     * Maximum number of shards to spawn concurrently
     */
    maxConcurrency?: number;
}
export declare class ShardingPlugin extends Plugin {
    readonly id = "sharding";
    protected client?: Client;
    readonly shards: Map<number, GatewayPlugin>;
    readonly config: ShardingPluginOptions;
    protected maxConcurrency: number;
    protected spawnQueue: number[];
    protected spawning: boolean;
    protected gatewayInfo?: APIGatewayBotInfo;
    customGatewayPlugin: typeof GatewayPlugin;
    constructor(options: ShardingPluginOptions);
    get ping(): Record<number, number | null>;
    registerClient(client: Client): Promise<void>;
    protected processSpawnQueue(): Promise<void>;
    disconnect(): void;
    /**
     * Calculate which shard a guild belongs to
     */
    getShardForGuild(guildId: string): GatewayPlugin | undefined;
    /**
     * Discord's sharding formula
     */
    calculateShardId(guildId: string, totalShards: number): number;
}
//# sourceMappingURL=ShardingPlugin.d.ts.map