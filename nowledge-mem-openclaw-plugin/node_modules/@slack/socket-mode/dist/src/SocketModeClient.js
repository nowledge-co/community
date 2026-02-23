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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketModeClient = void 0;
const web_api_1 = require("@slack/web-api");
const eventemitter3_1 = require("eventemitter3");
const package_json_1 = __importDefault(require("../package.json"));
const errors_1 = require("./errors");
const logger_1 = __importStar(require("./logger"));
const SlackWebSocket_1 = require("./SlackWebSocket");
const UnrecoverableSocketModeStartError_1 = require("./UnrecoverableSocketModeStartError");
// Lifecycle events as described in the README
var State;
(function (State) {
    State["Connecting"] = "connecting";
    State["Connected"] = "connected";
    State["Reconnecting"] = "reconnecting";
    State["Disconnecting"] = "disconnecting";
    State["Disconnected"] = "disconnected";
    State["Authenticated"] = "authenticated";
})(State || (State = {}));
/**
 * A Socket Mode Client allows programs to communicate with the
 * [Slack Platform's Events API](https://https://docs.slack.dev/apis/events-api) over WebSocket connections.
 * This object uses the EventEmitter pattern to dispatch incoming events
 * and has a built in send method to acknowledge incoming events over the WebSocket connection.
 */
class SocketModeClient extends eventemitter3_1.EventEmitter {
    constructor({ logger = undefined, logLevel = undefined, autoReconnectEnabled = true, pingPongLoggingEnabled = false, clientPingTimeout = 5000, serverPingTimeout = 30000, appToken = '', clientOptions = {}, } = { appToken: '' }) {
        super();
        /**
         * Internal count for managing the reconnection state
         */
        this.numOfConsecutiveReconnectionFailures = 0;
        this.customLoggerProvided = false;
        /**
         * Sentinel tracking if user invoked `disconnect()`; for enforcing shutting down of client
         * even if `autoReconnectEnabled` is `true`.
         */
        this.shuttingDown = false;
        if (!appToken) {
            throw new Error('Must provide an App-Level Token when initializing a Socket Mode Client');
        }
        this.pingPongLoggingEnabled = pingPongLoggingEnabled;
        this.clientPingTimeoutMS = clientPingTimeout;
        this.serverPingTimeoutMS = serverPingTimeout;
        // Setup the logger
        if (typeof logger !== 'undefined') {
            this.customLoggerProvided = true;
            this.logger = logger;
            if (typeof logLevel !== 'undefined') {
                this.logger.debug('The logLevel given to Socket Mode was ignored as you also gave logger');
            }
        }
        else {
            this.logger = logger_1.default.getLogger(SocketModeClient.loggerName, logLevel !== null && logLevel !== void 0 ? logLevel : logger_1.LogLevel.INFO, logger);
        }
        this.webClientOptions = clientOptions;
        if (this.webClientOptions.retryConfig === undefined) {
            // For faster retries of apps.connections.open API calls for reconnecting
            this.webClientOptions.retryConfig = { retries: 100, factor: 1.3 };
        }
        this.webClient = new web_api_1.WebClient('', Object.assign({ logger, logLevel: this.logger.getLevel(), headers: { Authorization: `Bearer ${appToken}` } }, clientOptions));
        this.autoReconnectEnabled = autoReconnectEnabled;
        // bind to error, message and close events emitted from the web socket
        this.on('error', (err) => {
            this.logger.error(`WebSocket error! ${err}`);
        });
        this.on('close', () => {
            // Underlying WebSocket connection was closed, possibly reconnect.
            if (!this.shuttingDown && this.autoReconnectEnabled) {
                this.delayReconnectAttempt(this.start);
            }
            else {
                // If reconnect is disabled or user explicitly called `disconnect()`, emit a disconnected state.
                this.emit(State.Disconnected);
            }
        });
        this.on('ws_message', this.onWebSocketMessage.bind(this));
        this.logger.debug('The Socket Mode client has successfully initialized');
    }
    // PUBLIC METHODS
    /**
     * Start a Socket Mode session app.
     * This method must be called before any messages can be sent or received,
     * or to disconnect the client via the `disconnect` method.
     */
    start() {
        return __awaiter(this, void 0, void 0, function* () {
            // python equiv: SocketModeClient.connect
            this.shuttingDown = false;
            this.logger.debug('Starting Socket Mode session ...');
            // create a socket connection using SlackWebSocket
            this.websocket = new SlackWebSocket_1.SlackWebSocket({
                url: yield this.retrieveWSSURL(),
                // web socket events relevant to this client will be emitted into the instance of this class
                // see bottom of constructor for where we bind to these events
                client: this,
                logLevel: this.logger.getLevel(),
                logger: this.customLoggerProvided ? this.logger : undefined,
                httpAgent: this.webClientOptions.agent,
                clientPingTimeoutMS: this.clientPingTimeoutMS,
                serverPingTimeoutMS: this.serverPingTimeoutMS,
                pingPongLoggingEnabled: this.pingPongLoggingEnabled,
            });
            // Return a promise that resolves with the connection information
            return new Promise((resolve, reject) => {
                var _a;
                // biome-ignore lint/suspicious/noExplicitAny: untyped connection callback parameters
                let connectedCallback = (_res) => { };
                // biome-ignore lint/suspicious/noExplicitAny: untyped connection callback parameters
                let disconnectedCallback = (_err) => { };
                connectedCallback = (result) => {
                    this.removeListener(State.Disconnected, disconnectedCallback);
                    resolve(result);
                };
                disconnectedCallback = (err) => {
                    this.removeListener(State.Connected, connectedCallback);
                    reject(err);
                };
                this.once(State.Connected, connectedCallback);
                this.once(State.Disconnected, disconnectedCallback);
                this.emit(State.Connecting);
                (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.connect();
            });
        });
    }
    /**
     * End a Socket Mode session. After this method is called no messages will be sent or received
     * unless you call start() again later.
     */
    disconnect() {
        this.shuttingDown = true;
        this.logger.debug('Manually disconnecting this Socket Mode client');
        this.emit(State.Disconnecting);
        return new Promise((resolve, _reject) => {
            var _a;
            if (!this.websocket) {
                this.emit(State.Disconnected);
                resolve();
            }
            else {
                // Resolve (or reject) on disconnect
                this.once(State.Disconnected, resolve);
                (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.disconnect();
            }
        });
    }
    // PRIVATE/PROTECTED METHODS
    /**
     * Initiates a reconnect, taking into account configurable delays and number of reconnect attempts and failures.
     * Accepts a callback to invoke after any calculated delays.
     */
    delayReconnectAttempt(cb) {
        this.numOfConsecutiveReconnectionFailures += 1;
        const msBeforeRetry = this.clientPingTimeoutMS * this.numOfConsecutiveReconnectionFailures;
        this.logger.debug(`Before trying to reconnect, this client will wait for ${msBeforeRetry} milliseconds`);
        return new Promise((res, _rej) => {
            setTimeout(() => {
                if (this.shuttingDown) {
                    this.logger.debug('Client shutting down, will not attempt reconnect.');
                }
                else {
                    this.logger.debug('Continuing with reconnect...');
                    this.emit(State.Reconnecting);
                    cb.apply(this).then(res);
                }
            }, msBeforeRetry);
        });
    }
    /**
     * Retrieves a new WebSocket URL to connect to.
     */
    retrieveWSSURL() {
        return __awaiter(this, void 0, void 0, function* () {
            // python equiv: BaseSocketModeClient.issue_new_wss_url
            try {
                this.logger.debug('Going to retrieve a new WSS URL ...');
                const resp = yield this.webClient.apps.connections.open({});
                if (!resp.url) {
                    const msg = `apps.connections.open did not return a URL! (response: ${resp})`;
                    this.logger.error(msg);
                    throw new Error(msg);
                }
                this.numOfConsecutiveReconnectionFailures = 0;
                this.emit(State.Authenticated, resp);
                return resp.url;
            }
            catch (error) {
                // TODO: Python catches rate limit errors when interacting with this API: https://github.com/slackapi/python-slack-sdk/blob/main/slack_sdk/socket_mode/client.py#L51
                this.logger.error(`Failed to retrieve a new WSS URL (error: ${error})`);
                const err = error;
                let isRecoverable = true;
                if (err.code === web_api_1.ErrorCode.PlatformError &&
                    Object.values(UnrecoverableSocketModeStartError_1.UnrecoverableSocketModeStartError).includes(err.data.error)) {
                    isRecoverable = false;
                }
                else if (err.code === web_api_1.ErrorCode.RequestError) {
                    isRecoverable = false;
                }
                else if (err.code === web_api_1.ErrorCode.HTTPError) {
                    isRecoverable = false;
                }
                if (this.autoReconnectEnabled && isRecoverable) {
                    return yield this.delayReconnectAttempt(this.retrieveWSSURL);
                }
                throw error;
            }
        });
    }
    /**
     * `onmessage` handler for the client's WebSocket.
     * This will parse the payload and dispatch the application-relevant events for each incoming message.
     * Mediates:
     * - raising the State.Connected event (when Slack sends a type:hello message)
     * - disconnecting the underlying socket (when Slack sends a type:disconnect message)
     */
    onWebSocketMessage(data, isBinary) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (isBinary) {
                this.logger.debug('Unexpected binary message received, ignoring.');
                return;
            }
            const payload = data.toString();
            // TODO: should we redact things in here?
            this.logger.debug(`Received a message on the WebSocket: ${payload}`);
            // Parse message into slack event
            let event;
            try {
                event = JSON.parse(payload);
            }
            catch (parseError) {
                // Prevent application from crashing on a bad message, but log an error to bring attention
                this.logger.debug(`Unable to parse an incoming WebSocket message (will ignore): ${parseError}, ${payload}`);
                return;
            }
            // Slack has finalized the handshake with a hello message; we are good to go.
            if (event.type === 'hello') {
                this.emit(State.Connected);
                return;
            }
            // Slack is recycling the pod handling the connection (or otherwise requires the client to reconnect)
            if (event.type === 'disconnect') {
                this.logger.debug(`Received "${event.type}" (${event.reason}) message - disconnecting.${this.autoReconnectEnabled ? ' Will reconnect.' : ''}`);
                (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.disconnect();
                return;
            }
            // Define Ack, a helper method for acknowledging events incoming from Slack
            const ack = (response) => __awaiter(this, void 0, void 0, function* () {
                if (this.logger.getLevel() === logger_1.LogLevel.DEBUG) {
                    this.logger.debug(`Calling ack() - type: ${event.type}, envelope_id: ${event.envelope_id}, data: ${JSON.stringify(response)}`);
                }
                yield this.send(event.envelope_id, response);
            });
            // For events_api messages, expose the type of the event
            if (event.type === 'events_api') {
                this.emit(event.payload.event.type, {
                    ack,
                    envelope_id: event.envelope_id,
                    body: event.payload,
                    event: event.payload.event,
                    retry_num: event.retry_attempt,
                    retry_reason: event.retry_reason,
                    accepts_response_payload: event.accepts_response_payload,
                });
            }
            else {
                // Emit just ack and body for all other types of messages
                this.emit(event.type, {
                    ack,
                    envelope_id: event.envelope_id,
                    body: event.payload,
                    accepts_response_payload: event.accepts_response_payload,
                });
            }
            // Emitter for all slack events
            // (this can be used in tools like bolt-js)
            this.emit('slack_event', {
                ack,
                envelope_id: event.envelope_id,
                type: event.type,
                body: event.payload,
                retry_num: event.retry_attempt,
                retry_reason: event.retry_reason,
                accepts_response_payload: event.accepts_response_payload,
            });
        });
    }
    /**
     * Method for sending an outgoing message of an arbitrary type over the WebSocket connection.
     * Primarily used to send acknowledgements back to slack for incoming events
     * @param id the envelope id
     * @param body the message body or string text
     */
    send(id, body = {}) {
        const _body = typeof body === 'string' ? { text: body } : body;
        const message = { envelope_id: id, payload: Object.assign({}, _body) };
        return new Promise((resolve, reject) => {
            var _a;
            const wsState = (_a = this.websocket) === null || _a === void 0 ? void 0 : _a.readyState;
            this.logger.debug(`send() method was called (WebSocket state: ${wsState ? SlackWebSocket_1.WS_READY_STATES[wsState] : 'uninitialized'})`);
            if (this.websocket === undefined) {
                this.logger.error('Failed to send a message as the client is not connected');
                reject((0, errors_1.sendWhileDisconnectedError)());
            }
            else if (!this.websocket.isActive()) {
                this.logger.error('Failed to send a message as the client has no active connection');
                reject((0, errors_1.sendWhileNotReadyError)());
            }
            else {
                this.emit('outgoing_message', message);
                const flatMessage = JSON.stringify(message);
                this.logger.debug(`Sending a WebSocket message: ${flatMessage}`);
                this.websocket.send(flatMessage, (error) => {
                    if (error) {
                        this.logger.error(`Failed to send a WebSocket message (error: ${error})`);
                        return reject((0, errors_1.websocketErrorWithOriginal)(error));
                    }
                    return resolve();
                });
            }
        });
    }
}
exports.SocketModeClient = SocketModeClient;
/**
 * The name used to prefix all logging generated from this class
 */
SocketModeClient.loggerName = 'SocketModeClient';
/* Instrumentation */
(0, web_api_1.addAppMetadata)({ name: package_json_1.default.name, version: package_json_1.default.version });
exports.default = SocketModeClient;
//# sourceMappingURL=SocketModeClient.js.map