import { EventEmitter } from "node:events";
import WebSocket from "ws";
import { Plugin } from "../../abstracts/Plugin.js";
import type { Client } from "../../classes/Client.js";
import { BabyCache } from "./BabyCache.js";
import { type APIGatewayBotInfo, type GatewayPayload, type GatewayPluginOptions, type GatewayState, type RequestGuildMembersData, type UpdatePresenceData, type UpdateVoiceStateData } from "./types.js";
import { ConnectionMonitor } from "./utils/monitor.js";
import { GatewayRateLimit } from "./utils/rateLimit.js";
export declare class GatewayPlugin extends Plugin {
    readonly id = "gateway";
    protected client?: Client;
    readonly options: GatewayPluginOptions;
    protected state: GatewayState;
    protected ws: WebSocket | null;
    protected monitor: ConnectionMonitor;
    protected rateLimit: GatewayRateLimit;
    heartbeatInterval?: NodeJS.Timeout;
    sequence: number | null;
    lastHeartbeatAck: boolean;
    protected emitter: EventEmitter;
    private reconnectAttempts;
    shardId?: number;
    totalShards?: number;
    protected gatewayInfo?: APIGatewayBotInfo;
    isConnected: boolean;
    protected pings: number[];
    protected babyCache: BabyCache;
    private reconnectTimeout?;
    private isConnecting;
    constructor(options: GatewayPluginOptions, gatewayInfo?: APIGatewayBotInfo);
    get ping(): number | null;
    registerClient(client: Client): Promise<void>;
    connect(resume?: boolean): void;
    disconnect(): void;
    protected createWebSocket(url: string): WebSocket;
    protected setupWebSocket(): void;
    protected handleReconnectionAttempt(options: {
        code?: number;
        isZombieConnection?: boolean;
        forceNoResume?: boolean;
    }): void;
    protected handleClose(code: number): void;
    protected handleZombieConnection(): void;
    protected handleReconnect(): void;
    protected canResume(): boolean;
    protected resume(): void;
    send(payload: GatewayPayload, skipRateLimit?: boolean): void;
    protected identify(): void;
    /**
     * Update the bot's presence (status, activity, etc.)
     * @param data Presence data to update
     */
    updatePresence(data: UpdatePresenceData): void;
    /**
     * Update the bot's voice state
     * @param data Voice state data to update
     */
    updateVoiceState(data: UpdateVoiceStateData): void;
    /**
     * Request guild members from Discord. The data will come in through the GUILD_MEMBERS_CHUNK event, not as a return on this function.
     * @param data Guild members request data
     */
    requestGuildMembers(data: RequestGuildMembersData): void;
    /**
     * Get the current rate limit status
     */
    getRateLimitStatus(): {
        remainingEvents: number;
        resetTime: number;
        currentEventCount: number;
    };
    /**
     * Get information about optionsured intents
     */
    getIntentsInfo(): {
        intents: number;
        hasGuilds: boolean;
        hasGuildMembers: boolean;
        hasGuildPresences: boolean;
        hasGuildMessages: boolean;
        hasMessageContent: boolean;
    };
    /**
     * Check if a specific intent is enabled
     * @param intent The intent to check
     */
    hasIntent(intent: number): boolean;
    private ensureGatewayParams;
}
//# sourceMappingURL=GatewayPlugin.d.ts.map