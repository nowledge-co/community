import { EventEmitter } from "node:events";
export class ConnectionMonitor extends EventEmitter {
    metrics = {
        latency: 0,
        uptime: 0,
        reconnects: 0,
        zombieConnections: 0,
        messagesReceived: 0,
        messagesSent: 0,
        errors: 0
    };
    startTime = Date.now();
    lastHeartbeat = 0;
    metricsInterval;
    config;
    constructor(config = {}) {
        super();
        this.config = {
            interval: config.interval ?? 60000,
            latencyThreshold: config.latencyThreshold ?? 1000
        };
        this.metricsInterval = this.createMetricsInterval();
    }
    createMetricsInterval() {
        return setInterval(() => {
            this.metrics.uptime = Date.now() - this.startTime;
            this.emit("metrics", this.getMetrics());
            if (this.metrics.latency > this.config.latencyThreshold) {
                this.emit("warning", `High latency detected: ${this.metrics.latency}ms`);
            }
            const errorRate = (this.metrics.errors /
                (this.metrics.uptime / 60000)).toFixed(1);
            if (Number(errorRate) > 5) {
                this.emit("warning", `High error rate detected: ${errorRate} errors/minute`);
            }
        }, this.config.interval);
    }
    recordError() {
        this.metrics.errors++;
    }
    recordZombieConnection() {
        this.metrics.zombieConnections++;
    }
    recordHeartbeat() {
        this.lastHeartbeat = Date.now();
    }
    recordHeartbeatAck() {
        if (this.lastHeartbeat > 0) {
            this.metrics.latency = Date.now() - this.lastHeartbeat;
        }
    }
    recordReconnect() {
        this.metrics.reconnects++;
    }
    recordMessageReceived() {
        this.metrics.messagesReceived++;
    }
    recordMessageSent() {
        this.metrics.messagesSent++;
    }
    resetUptime() {
        clearInterval(this.metricsInterval);
        this.metrics.uptime = 0;
        this.startTime = Date.now();
        this.metricsInterval = this.createMetricsInterval();
    }
    getMetrics() {
        return { ...this.metrics };
    }
    reset() {
        this.metrics = {
            latency: 0,
            uptime: 0,
            reconnects: 0,
            zombieConnections: 0,
            messagesReceived: 0,
            messagesSent: 0,
            errors: 0
        };
        this.startTime = Date.now();
        this.lastHeartbeat = 0;
    }
    destroy() {
        clearInterval(this.metricsInterval);
        this.removeAllListeners();
    }
}
//# sourceMappingURL=monitor.js.map