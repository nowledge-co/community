import { GatewayOpcodes } from "../types.js";
export interface HeartbeatManager {
    sequence: number | null;
    lastHeartbeatAck: boolean;
    heartbeatInterval?: NodeJS.Timeout;
    firstHeartbeatTimeout?: NodeJS.Timeout;
    send(payload: {
        op: (typeof GatewayOpcodes)[keyof typeof GatewayOpcodes];
        d: number | null;
    }): void;
}
export interface HeartbeatOptions {
    interval: number;
    reconnectCallback: () => void;
}
export declare function startHeartbeat(manager: HeartbeatManager, options: HeartbeatOptions): void;
export declare function stopHeartbeat(manager: HeartbeatManager): void;
//# sourceMappingURL=heartbeat.d.ts.map