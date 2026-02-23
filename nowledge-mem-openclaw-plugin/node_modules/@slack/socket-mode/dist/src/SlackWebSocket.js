"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SlackWebSocket = exports.WS_READY_STATES = void 0;
const ws_1 = require("ws");
const errors_1 = require("./errors");
const logger_1 = __importStar(require("./logger"));
// Maps ws `readyState` to human readable labels https://github.com/websockets/ws/blob/HEAD/doc/ws.md#ready-state-constants
exports.WS_READY_STATES = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
/**
 * Encapsulates the Slack-specific details around establishing a WebSocket connection with the Slack backend.
 * Manages the ping/pong heartbeat of the connection.
 */
class SlackWebSocket {
    constructor({ url, client, httpAgent, logger, logLevel = logger_1.LogLevel.INFO, pingInterval = 5000, pingPongLoggingEnabled = false, serverPingTimeoutMS = 30000, clientPingTimeoutMS = 5000, }) {
        this.options = {
            url,
            client,
            httpAgent,
            logLevel,
            pingInterval,
            pingPongLoggingEnabled,
            serverPingTimeoutMS,
            clientPingTimeoutMS,
        };
        if (logger) {
            this.logger = logger;
        }
        else {
            this.logger = logger_1.default.getLogger(SlackWebSocket.loggerName, logLevel);
        }
        this.websocket = null;
        this.closeFrameReceived = false;
    }
    /**
     * Establishes a connection with the Slack backend
     */
    connect() {
        this.logger.debug('Initiating new WebSocket connection.');
        const options = {
            perMessageDeflate: false,
            agent: this.options.httpAgent,
        };
        this.websocket = new ws_1.WebSocket(this.options.url, options);
        this.websocket.addEventListener('open', (_event) => {
            this.logger.debug('WebSocket open event received (connection established)!');
            this.monitorPingToSlack();
        });
        this.websocket.addEventListener('error', (event) => {
            this.logger.error(`WebSocket error occurred: ${event.message}`);
            this.disconnect();
            this.options.client.emit('error', (0, errors_1.websocketErrorWithOriginal)(event.error));
        });
        this.websocket.on('message', (msg, isBinary) => {
            this.options.client.emit('ws_message', msg, isBinary);
        });
        this.websocket.on('close', (code, data) => {
            this.logger.debug(`WebSocket close frame received (code: ${code}, reason: ${data.toString()})`);
            this.closeFrameReceived = true;
            this.disconnect();
        });
        // Confirm WebSocket connection is still active
        this.websocket.on('ping', (data) => {
            // Note that ws' `autoPong` option is true by default, so no need to respond to ping.
            // see https://github.com/websockets/ws/blob/2aa0405a5e96754b296fef6bd6ebdfb2f11967fc/doc/ws.md#new-websocketaddress-protocols-options
            if (this.options.pingPongLoggingEnabled) {
                this.logger.debug(`WebSocket received ping from Slack server (data: ${data.toString()})`);
            }
            this.monitorPingFromSlack();
        });
        this.websocket.on('pong', (data) => {
            if (this.options.pingPongLoggingEnabled) {
                this.logger.debug(`WebSocket received pong from Slack server (data: ${data.toString()})`);
            }
            this.lastPongReceivedTimestamp = Date.now();
        });
    }
    /**
     * Disconnects the WebSocket connection with Slack, if connected.
     */
    disconnect() {
        if (this.websocket) {
            // Disconnecting a WebSocket involves a close frame handshake so we check if we've already received a close frame.
            // If so, we can terminate the underlying socket connection and let the client know.
            if (this.closeFrameReceived) {
                this.logger.debug('Terminating WebSocket (close frame received).');
                this.terminate();
            }
            else {
                // If we haven't received a close frame yet, then we send one to the peer, expecting to receive a close frame
                // in response.
                this.logger.debug('Sending close frame (status=1000).');
                this.websocket.close(1000); // send a close frame, 1000=Normal Closure
            }
        }
        else {
            this.logger.debug('WebSocket already disconnected, flushing remainder.');
            this.terminate();
        }
    }
    /**
     * Clean up any underlying intervals, timeouts and the WebSocket.
     */
    terminate() {
        var _a, _b;
        (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.removeAllListeners();
        (_b = this.websocket) === null || _b === void 0 ? void 0 : _b.terminate();
        this.websocket = null;
        clearTimeout(this.serverPingTimeout);
        clearInterval(this.clientPingTimeout);
        // Emit event back to client letting it know connection has closed (in case it needs to reconnect if
        // reconnecting is enabled)
        this.options.client.emit('close');
    }
    /**
     * Returns true if the underlying WebSocket connection is active, meaning the underlying
     * {@link https://github.com/websockets/ws/blob/master/doc/ws.md#ready-state-constants WebSocket ready state is "OPEN"}.
     */
    isActive() {
        // python equiv: SocketModeClient.is_connected
        if (!this.websocket) {
            this.logger.debug('isActive(): websocket not instantiated!');
            return false;
        }
        this.logger.debug(`isActive(): websocket ready state is ${exports.WS_READY_STATES[this.websocket.readyState]}`);
        return this.websocket.readyState === 1; // readyState=1 is "OPEN"
    }
    /**
     * Retrieve the underlying WebSocket readyState. Returns `undefined` if the WebSocket has not been instantiated,
     * otherwise will return a number between 0 and 3 inclusive representing the ready states.
     * The ready state constants are documented in the {@link https://github.com/websockets/ws/blob/master/doc/ws.md#ready-state-constants `ws` API docs }
     */
    get readyState() {
        var _a;
        return (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.readyState;
    }
    /**
     * Sends data via the underlying WebSocket. Accepts an errorback argument.
     */
    send(data, cb) {
        var _a;
        (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.send(data, cb);
    }
    /**
     * Confirms WebSocket connection is still active; fires whenever a ping event is received
     * If we don't receive another ping from the peer before the timeout, we initiate closing the connection.
     */
    monitorPingFromSlack() {
        clearTimeout(this.serverPingTimeout);
        this.serverPingTimeout = setTimeout(() => {
            this.logger.warn(`A ping wasn't received from the server before the timeout of ${this.options.serverPingTimeoutMS}ms!`);
            this.disconnect();
        }, this.options.serverPingTimeoutMS);
    }
    /**
     * Monitors WebSocket connection health; sends a ping to peer, and expects a pong within a certain timeframe.
     * If that expectation is not met, we disconnect the websocket.
     */
    monitorPingToSlack() {
        this.lastPongReceivedTimestamp = undefined;
        let pingAttemptCount = 0;
        clearInterval(this.clientPingTimeout);
        this.clientPingTimeout = setInterval(() => {
            var _a;
            const now = Date.now();
            try {
                const pingMessage = `Ping from client (${now})`;
                (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.ping(pingMessage);
                if (this.lastPongReceivedTimestamp === undefined) {
                    pingAttemptCount += 1;
                }
                else {
                    // if lastPongReceivedTimestamp is defined, then the server has responded to pings at some point in the past
                    pingAttemptCount = 0;
                }
                if (this.options.pingPongLoggingEnabled) {
                    this.logger.debug(`Sent ping to Slack: ${pingMessage}`);
                }
            }
            catch (e) {
                this.logger.error(`Failed to send ping to Slack (error: ${e})`);
                this.disconnect();
                return;
            }
            // default invalid state is: sent > 3 pings to the server and it never responded with a pong
            let isInvalid = pingAttemptCount > 3;
            if (this.lastPongReceivedTimestamp !== undefined) {
                // secondary invalid state is: if we did receive a pong from the server,
                // has the elapsed time since the last pong exceeded the client ping timeout
                const millis = now - this.lastPongReceivedTimestamp;
                isInvalid = millis > this.options.clientPingTimeoutMS;
            }
            if (isInvalid) {
                this.logger.warn(`A pong wasn't received from the server before the timeout of ${this.options.clientPingTimeoutMS}ms!`);
                this.disconnect();
            }
        }, this.options.clientPingTimeoutMS / 3);
        this.logger.debug('Started monitoring pings to and pongs from Slack.');
    }
}
exports.SlackWebSocket = SlackWebSocket;
// python equiv: Connection
SlackWebSocket.loggerName = 'SlackWebSocket';
//# sourceMappingURL=SlackWebSocket.js.map