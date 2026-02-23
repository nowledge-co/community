import { EventEmitter } from "node:events";
export interface ConnectionMetrics {
    latency: number;
    uptime: number;
    reconnects: number;
    zombieConnections: number;
    messagesReceived: number;
    messagesSent: number;
    errors: number;
}
export interface MonitorConfig {
    /** Monitoring interval in milliseconds (default: 60000) */
    interval?: number;
    /** Warning threshold for latency in milliseconds (default: 1000) */
    latencyThreshold?: number;
}
export declare class ConnectionMonitor extends EventEmitter {
    private metrics;
    private startTime;
    private lastHeartbeat;
    private metricsInterval;
    private readonly config;
    constructor(config?: MonitorConfig);
    private createMetricsInterval;
    recordError(): void;
    recordZombieConnection(): void;
    recordHeartbeat(): void;
    recordHeartbeatAck(): void;
    recordReconnect(): void;
    recordMessageReceived(): void;
    recordMessageSent(): void;
    resetUptime(): void;
    getMetrics(): ConnectionMetrics;
    reset(): void;
    destroy(): void;
}
//# sourceMappingURL=monitor.d.ts.map