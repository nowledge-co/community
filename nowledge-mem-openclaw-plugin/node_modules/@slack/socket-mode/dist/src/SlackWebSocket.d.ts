import type { Agent } from 'node:http';
import type { EventEmitter } from 'eventemitter3';
import { type Logger, LogLevel } from './logger';
export declare const WS_READY_STATES: string[];
export interface SlackWebSocketOptions {
    /** @description The Slack WebSocket URL to connect to. */
    url: string;
    /** @description An instance of EventEmitter where socket-related events can be emitted to. */
    client: EventEmitter;
    /** @description A LogLevel at which this class should log to. */
    logLevel?: LogLevel;
    /** @description A Logger instance used to log activity to. */
    logger?: Logger;
    /** @description Delay between this client sending a `ping` message, in milliseconds. */
    pingInterval?: number;
    /** @description The HTTP Agent to use when establishing a WebSocket connection. */
    httpAgent?: Agent;
    /** @description Whether this WebSocket should DEBUG log ping and pong events. `false` by default. */
    pingPongLoggingEnabled?: boolean;
    /**
     * @description How many milliseconds to wait between ping events from the server before deeming the connection
     * stale. Defaults to 30,000.
     */
    serverPingTimeoutMS: number;
    /**
     * @description How many milliseconds to wait between ping events from the server before deeming the connection
     * stale. Defaults to 5,000.
     */
    clientPingTimeoutMS: number;
}
/**
 * Encapsulates the Slack-specific details around establishing a WebSocket connection with the Slack backend.
 * Manages the ping/pong heartbeat of the connection.
 */
export declare class SlackWebSocket {
    private static loggerName;
    private options;
    private logger;
    private websocket;
    /**
     * The last timetamp that this WebSocket received pong from the server
     */
    private lastPongReceivedTimestamp;
    /**
     * Sentinel checking if Slack sent us a close frame or not, in order to be able
     * to terminate underlying socket gracefully.
     */
    private closeFrameReceived;
    /**
     * Reference to the timeout timer we use to listen to pings from the server
     */
    private serverPingTimeout;
    /**
     * Reference to the timeout timer we use to listen to pongs from the server
     */
    private clientPingTimeout;
    constructor({ url, client, httpAgent, logger, logLevel, pingInterval, pingPongLoggingEnabled, serverPingTimeoutMS, clientPingTimeoutMS, }: SlackWebSocketOptions);
    /**
     * Establishes a connection with the Slack backend
     */
    connect(): void;
    /**
     * Disconnects the WebSocket connection with Slack, if connected.
     */
    disconnect(): void;
    /**
     * Clean up any underlying intervals, timeouts and the WebSocket.
     */
    private terminate;
    /**
     * Returns true if the underlying WebSocket connection is active, meaning the underlying
     * {@link https://github.com/websockets/ws/blob/master/doc/ws.md#ready-state-constants WebSocket ready state is "OPEN"}.
     */
    isActive(): boolean;
    /**
     * Retrieve the underlying WebSocket readyState. Returns `undefined` if the WebSocket has not been instantiated,
     * otherwise will return a number between 0 and 3 inclusive representing the ready states.
     * The ready state constants are documented in the {@link https://github.com/websockets/ws/blob/master/doc/ws.md#ready-state-constants `ws` API docs }
     */
    get readyState(): number | undefined;
    /**
     * Sends data via the underlying WebSocket. Accepts an errorback argument.
     */
    send(data: string, cb: (err: Error | undefined) => void): void;
    /**
     * Confirms WebSocket connection is still active; fires whenever a ping event is received
     * If we don't receive another ping from the peer before the timeout, we initiate closing the connection.
     */
    private monitorPingFromSlack;
    /**
     * Monitors WebSocket connection health; sends a ping to peer, and expects a pong within a certain timeframe.
     * If that expectation is not met, we disconnect the websocket.
     */
    private monitorPingToSlack;
}
//# sourceMappingURL=SlackWebSocket.d.ts.map