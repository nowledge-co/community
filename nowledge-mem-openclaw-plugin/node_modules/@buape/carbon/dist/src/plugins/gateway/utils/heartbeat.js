import { GatewayOpcodes } from "../types.js";
export function startHeartbeat(manager, options) {
    stopHeartbeat(manager);
    manager.lastHeartbeatAck = true;
    const jitter = Math.random();
    const initialDelay = Math.floor(options.interval * jitter);
    const interval = options.interval;
    const sendHeartbeat = () => {
        if (!manager.lastHeartbeatAck) {
            options.reconnectCallback();
            return;
        }
        manager.lastHeartbeatAck = false;
        manager.send({
            op: GatewayOpcodes.Heartbeat,
            d: manager.sequence
        });
    };
    manager.firstHeartbeatTimeout = setTimeout(() => {
        sendHeartbeat();
        manager.heartbeatInterval = setInterval(sendHeartbeat, interval);
    }, initialDelay);
}
export function stopHeartbeat(manager) {
    if (manager.firstHeartbeatTimeout) {
        clearTimeout(manager.firstHeartbeatTimeout);
        manager.firstHeartbeatTimeout = undefined;
    }
    if (manager.heartbeatInterval) {
        clearInterval(manager.heartbeatInterval);
        manager.heartbeatInterval = undefined;
    }
}
//# sourceMappingURL=heartbeat.js.map