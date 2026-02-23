import { type AppsConnectionsOpenResponse } from '@slack/web-api';
import { EventEmitter } from 'eventemitter3';
import type WebSocket from 'ws';
import { SlackWebSocket } from './SlackWebSocket';
import type { SocketModeOptions } from './SocketModeOptions';
/**
 * A Socket Mode Client allows programs to communicate with the
 * [Slack Platform's Events API](https://https://docs.slack.dev/apis/events-api) over WebSocket connections.
 * This object uses the EventEmitter pattern to dispatch incoming events
 * and has a built in send method to acknowledge incoming events over the WebSocket connection.
 */
export declare class SocketModeClient extends EventEmitter {
    /**
     * Whether this client will automatically reconnect when (not manually) disconnected
     */
    private autoReconnectEnabled;
    /**
     * This class' logging instance
     */
    private logger;
    /**
     * The name used to prefix all logging generated from this class
     */
    private static loggerName;
    /**
     * The HTTP client used to interact with the Slack API
     */
    private webClient;
    /**
     * WebClient options we pass to our WebClient instance
     * We also reuse agent and tls for our WebSocket connection
     */
    private webClientOptions;
    /**
     * The underlying WebSocket client instance
     */
    websocket?: SlackWebSocket;
    /**
     * Enables ping-pong detailed logging if true
     */
    private pingPongLoggingEnabled;
    /**
     * How long to wait for pings from server before timing out
     */
    private serverPingTimeoutMS;
    /**
     * How long to wait for pongs from server before timing out
     */
    private clientPingTimeoutMS;
    /**
     * Internal count for managing the reconnection state
     */
    private numOfConsecutiveReconnectionFailures;
    private customLoggerProvided;
    /**
     * Sentinel tracking if user invoked `disconnect()`; for enforcing shutting down of client
     * even if `autoReconnectEnabled` is `true`.
     */
    private shuttingDown;
    constructor({ logger, logLevel, autoReconnectEnabled, pingPongLoggingEnabled, clientPingTimeout, serverPingTimeout, appToken, clientOptions, }?: SocketModeOptions);
    /**
     * Start a Socket Mode session app.
     * This method must be called before any messages can be sent or received,
     * or to disconnect the client via the `disconnect` method.
     */
    start(): Promise<AppsConnectionsOpenResponse>;
    /**
     * End a Socket Mode session. After this method is called no messages will be sent or received
     * unless you call start() again later.
     */
    disconnect(): Promise<void>;
    /**
     * Initiates a reconnect, taking into account configurable delays and number of reconnect attempts and failures.
     * Accepts a callback to invoke after any calculated delays.
     */
    private delayReconnectAttempt;
    /**
     * Retrieves a new WebSocket URL to connect to.
     */
    private retrieveWSSURL;
    /**
     * `onmessage` handler for the client's WebSocket.
     * This will parse the payload and dispatch the application-relevant events for each incoming message.
     * Mediates:
     * - raising the State.Connected event (when Slack sends a type:hello message)
     * - disconnecting the underlying socket (when Slack sends a type:disconnect message)
     */
    protected onWebSocketMessage(data: WebSocket.RawData, isBinary: boolean): Promise<void>;
    /**
     * Method for sending an outgoing message of an arbitrary type over the WebSocket connection.
     * Primarily used to send acknowledgements back to slack for incoming events
     * @param id the envelope id
     * @param body the message body or string text
     */
    private send;
}
export default SocketModeClient;
//# sourceMappingURL=SocketModeClient.d.ts.map