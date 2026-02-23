"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
const node_util_1 = __importDefault(require("node:util"));
const logger_1 = require("@slack/logger");
const web_api_1 = require("@slack/web-api");
const axios_1 = __importDefault(require("axios"));
const CustomFunction_1 = require("./CustomFunction");
const conversation_store_1 = require("./conversation-store");
const errors_1 = require("./errors");
const helpers_1 = require("./helpers");
const builtin_1 = require("./middleware/builtin");
const process_1 = __importDefault(require("./middleware/process"));
const HTTPReceiver_1 = __importDefault(require("./receivers/HTTPReceiver"));
const SocketModeReceiver_1 = __importDefault(require("./receivers/SocketModeReceiver"));
const types_1 = require("./types");
const utilities_1 = require("./types/utilities");
const packageJson = require('../package.json');
// ----------------------------
// For listener registration methods
// TODO: we have types for this... consolidate
const validViewTypes = ['view_closed', 'view_submission'];
// ----------------------------
// For the constructor
const tokenUsage = 'Apps used in a single workspace can be initialized with a token. Apps used in many workspaces ' +
    'should be initialized with oauth installer options or authorize.';
var logger_2 = require("@slack/logger");
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return logger_2.LogLevel; } });
class WebClientPool {
    pool = {};
    getOrCreate(token, clientOptions) {
        const cachedClient = this.pool[token];
        if (typeof cachedClient !== 'undefined') {
            return cachedClient;
        }
        const client = new web_api_1.WebClient(token, clientOptions);
        this.pool[token] = client;
        return client;
    }
}
/**
 * A Slack App
 */
class App {
    /** Slack Web API client */
    client;
    clientOptions;
    // Some payloads don't have teamId anymore. So we use EnterpriseId in those scenarios
    clients = {};
    /** Receiver - ingests events from the Slack platform */
    receiver;
    /** Logger */
    logger;
    /** Log Level */
    logLevel;
    /** Authorize */
    authorize;
    /** Global middleware chain */
    middleware;
    /** Listener middleware chains */
    listeners;
    errorHandler;
    axios;
    installerOptions;
    socketMode;
    developerMode;
    extendedErrorHandler;
    hasCustomErrorHandler;
    // used when deferInitialization is true
    argToken;
    // used when deferInitialization is true
    argAuthorize;
    // used when deferInitialization is true
    argAuthorization;
    tokenVerificationEnabled;
    initialized;
    attachFunctionToken;
    constructor({ signingSecret = undefined, endpoints = undefined, port = undefined, customRoutes = undefined, agent = undefined, clientTls = undefined, receiver = undefined, convoStore = undefined, token = undefined, appToken = undefined, botId = undefined, botUserId = undefined, authorize = undefined, logger = undefined, logLevel = undefined, ignoreSelf = true, clientOptions = undefined, processBeforeResponse = false, signatureVerification = true, clientId = undefined, clientSecret = undefined, stateSecret = undefined, redirectUri = undefined, installationStore = undefined, scopes = undefined, installerOptions = undefined, socketMode = undefined, developerMode = false, tokenVerificationEnabled = true, extendedErrorHandler = false, deferInitialization = false, attachFunctionToken = true, } = {}) {
        /* ------------------------ Developer mode ----------------------------- */
        this.developerMode = developerMode;
        if (developerMode) {
            // Set logLevel to Debug in Developer Mode if one wasn't passed in
            this.logLevel = logLevel ?? logger_1.LogLevel.DEBUG;
            // Set SocketMode to true if one wasn't passed in
            this.socketMode = socketMode ?? true;
        }
        else {
            // If devs aren't using Developer Mode or Socket Mode, set it to false
            this.socketMode = socketMode ?? false;
            // Set logLevel to Info if one wasn't passed in
            this.logLevel = logLevel ?? logger_1.LogLevel.INFO;
        }
        /* ------------------------ Set logger ----------------------------- */
        if (typeof logger === 'undefined') {
            // Initialize with the default logger
            const consoleLogger = new logger_1.ConsoleLogger();
            consoleLogger.setName('bolt-app');
            this.logger = consoleLogger;
        }
        else {
            this.logger = logger;
        }
        if (typeof this.logLevel !== 'undefined' && this.logger.getLevel() !== this.logLevel) {
            this.logger.setLevel(this.logLevel);
        }
        // Error-related properties used to later determine args passed into the error handler
        this.hasCustomErrorHandler = false;
        this.errorHandler = defaultErrorHandler(this.logger);
        this.extendedErrorHandler = extendedErrorHandler;
        // Override token with functionBotAccessToken in function-related handlers
        this.attachFunctionToken = attachFunctionToken;
        /* ------------------------ Set client options ------------------------*/
        this.clientOptions = clientOptions !== undefined ? clientOptions : {};
        if (agent !== undefined && this.clientOptions.agent === undefined) {
            this.clientOptions.agent = agent;
        }
        if (clientTls !== undefined && this.clientOptions.tls === undefined) {
            this.clientOptions.tls = clientTls;
        }
        if (logLevel !== undefined && logger === undefined) {
            // only logLevel is passed
            this.clientOptions.logLevel = logLevel;
        }
        else {
            // Since v3.4, WebClient starts sharing logger with App
            this.clientOptions.logger = this.logger;
        }
        // The public WebClient instance (app.client)
        // Since v3.4, it can have the passed token in the case of single workspace installation.
        this.client = new web_api_1.WebClient(token, this.clientOptions);
        this.axios = axios_1.default.create({
            httpAgent: agent,
            httpsAgent: agent,
            // disabling axios' automatic proxy support:
            // axios would read from env vars to configure a proxy automatically, but it doesn't support TLS destinations.
            // for compatibility with https://api.slack.com, and for a larger set of possible proxies (SOCKS or other
            // protocols), users of this package should use the `agent` option to configure a proxy.
            proxy: false,
            ...clientTls,
        });
        this.middleware = [];
        this.listeners = [];
        // Add clientOptions to InstallerOptions to pass them to @slack/oauth
        this.installerOptions = {
            clientOptions: this.clientOptions,
            ...installerOptions,
        };
        if (socketMode && port !== undefined && this.installerOptions.port === undefined) {
            // SocketModeReceiver only uses a custom port number  when listening for the OAuth flow.
            // Therefore, only installerOptions.port is available in the constructor arguments.
            this.installerOptions.port = port;
        }
        if (this.developerMode &&
            this.installerOptions &&
            (typeof this.installerOptions.callbackOptions === 'undefined' ||
                (typeof this.installerOptions.callbackOptions !== 'undefined' &&
                    typeof this.installerOptions.callbackOptions.failure === 'undefined'))) {
            // add a custom failure callback for Developer Mode in case they are using OAuth
            this.logger.debug('adding Developer Mode custom OAuth failure handler');
            this.installerOptions.callbackOptions = {
                failure: (error, _installOptions, _req, res) => {
                    this.logger.debug(error);
                    res.writeHead(500, { 'Content-Type': 'text/html' });
                    res.end(`<html><body><h1>OAuth failed!</h1><div>${escapeHtml(error.code)}</div></body></html>`);
                },
            };
        }
        this.receiver = this.initReceiver(receiver, signingSecret, endpoints, port, customRoutes, processBeforeResponse, signatureVerification, clientId, clientSecret, stateSecret, redirectUri, installationStore, scopes, appToken, logger);
        /* ------------------------ Set authorize ----------------------------- */
        this.tokenVerificationEnabled = tokenVerificationEnabled;
        let argAuthorization;
        if (token !== undefined) {
            argAuthorization = {
                botId,
                botUserId,
                botToken: token,
            };
        }
        if (deferInitialization) {
            this.argToken = token;
            this.argAuthorize = authorize;
            this.argAuthorization = argAuthorization;
            this.initialized = false;
            // You need to run `await app.init();` on your own
        }
        else {
            this.authorize = this.initAuthorizeInConstructor(token, authorize, argAuthorization);
            this.initialized = true;
        }
        // Conditionally use a global middleware that ignores events (including messages) that are sent from this app
        if (ignoreSelf) {
            this.use(builtin_1.ignoreSelf);
        }
        // Use conversation state global middleware
        if (convoStore !== false) {
            // Use the memory store by default, or another store if provided
            const store = convoStore === undefined ? new conversation_store_1.MemoryStore() : convoStore;
            this.use((0, conversation_store_1.conversationContext)(store));
        }
        /* ------------------------ Initialize receiver ------------------------ */
        // Should be last to avoid exposing partially initialized app
        this.receiver.init(this);
    }
    async init() {
        this.initialized = true;
        try {
            const initializedAuthorize = this.initAuthorizeIfNoTokenIsGiven(this.argToken, this.argAuthorize);
            if (initializedAuthorize !== undefined) {
                this.authorize = initializedAuthorize;
                return;
            }
            if (this.argToken !== undefined && this.argAuthorization !== undefined) {
                let authorization = this.argAuthorization;
                if (this.tokenVerificationEnabled) {
                    const authTestResult = await this.client.auth.test({ token: this.argToken });
                    if (authTestResult.ok) {
                        authorization = {
                            botUserId: authTestResult.user_id,
                            botId: authTestResult.bot_id,
                            botToken: this.argToken,
                        };
                    }
                }
                this.authorize = singleAuthorization(this.client, authorization, this.tokenVerificationEnabled);
                this.initialized = true;
            }
            else {
                this.logger.error('Something has gone wrong. Please report this issue to the maintainers. https://github.com/slackapi/bolt-js/issues');
                (0, helpers_1.assertNever)();
            }
        }
        catch (e) {
            // Revert the flag change as the initialization failed
            this.initialized = false;
            throw e;
        }
    }
    get webClientOptions() {
        return this.clientOptions;
    }
    /**
     * Register a new middleware, processed in the order registered.
     *
     * @param m global middleware function
     */
    use(m) {
        this.middleware.push(m);
        return this;
    }
    /**
     * Register Assistant middleware
     *
     * @param assistant global assistant middleware function
     */
    assistant(assistant) {
        const m = assistant.getMiddleware();
        this.middleware.push(m);
        return this;
    }
    /**
     * Register WorkflowStep middleware
     *
     * @param workflowStep global workflow step middleware function
     * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
     * version.
     */
    step(workflowStep) {
        const m = workflowStep.getMiddleware();
        this.middleware.push(m);
        return this;
    }
    function(callbackId, ...optionOrListeners) {
        const options = (0, builtin_1.isSlackEventMiddlewareArgsOptions)(optionOrListeners[0])
            ? optionOrListeners[0]
            : { autoAcknowledge: true };
        const listeners = optionOrListeners.filter((optionOrListener) => {
            return !(0, builtin_1.isSlackEventMiddlewareArgsOptions)(optionOrListener);
        });
        const fn = new CustomFunction_1.CustomFunction(callbackId, listeners, options);
        this.listeners.push(fn.getListeners());
        return this;
    }
    /**
     * Convenience method to call start on the receiver
     *
     * TODO: should replace HTTPReceiver in type definition with a generic that is constrained to Receiver
     *
     * @param args receiver-specific start arguments
     */
    start(...args) {
        if (!this.initialized) {
            throw new errors_1.AppInitializationError('This App instance is not yet initialized. Call `await App#init()` before starting the app.');
        }
        // TODO: HTTPReceiver['start'] should be the actual receiver's return type
        return this.receiver.start(...args);
    }
    // biome-ignore lint/suspicious/noExplicitAny: receivers could accept anything as arguments for stop
    stop(...args) {
        return this.receiver.stop(...args);
    }
    event(eventNameOrPattern, ...listeners) {
        let invalidEventName = false;
        if (typeof eventNameOrPattern === 'string') {
            const name = eventNameOrPattern;
            invalidEventName = name.startsWith('message.');
        }
        else if (eventNameOrPattern instanceof RegExp) {
            const name = eventNameOrPattern.source;
            invalidEventName = name.startsWith('message\\.');
        }
        if (invalidEventName) {
            throw new errors_1.AppInitializationError(`Although the document mentions "${eventNameOrPattern}", it is not a valid event type. Use "message" instead. If you want to filter message events, you can use event.channel_type for it.`);
        }
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        const _listeners = listeners;
        this.listeners.push([
            builtin_1.onlyEvents,
            (0, builtin_1.matchEventType)(eventNameOrPattern),
            ..._listeners,
        ]);
    }
    // TODO: expose a type parameter for overriding the MessageEvent type (just like shortcut() and action() does) https://github.com/slackapi/bolt-js/issues/796
    message(...patternsOrMiddleware) {
        const messageMiddleware = patternsOrMiddleware.map((patternOrMiddleware) => {
            if (typeof patternOrMiddleware === 'string' || node_util_1.default.types.isRegExp(patternOrMiddleware)) {
                return (0, builtin_1.matchMessage)(patternOrMiddleware);
            }
            return patternOrMiddleware;
            // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        });
        this.listeners.push([
            builtin_1.onlyEvents,
            (0, builtin_1.matchEventType)('message'),
            ...messageMiddleware,
        ]);
    }
    shortcut(callbackIdOrConstraints, ...listeners) {
        const constraints = typeof callbackIdOrConstraints === 'string' || node_util_1.default.types.isRegExp(callbackIdOrConstraints)
            ? { callback_id: callbackIdOrConstraints }
            : callbackIdOrConstraints;
        // Fail early if the constraints contain invalid keys
        const unknownConstraintKeys = Object.keys(constraints).filter((k) => k !== 'callback_id' && k !== 'type');
        if (unknownConstraintKeys.length > 0) {
            // TODO:event() will throw an error if you provide an invalid event name; we should align this behaviour.
            this.logger.error(`Slack listener cannot be attached using unknown constraint keys: ${unknownConstraintKeys.join(', ')}`);
            return;
        }
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        const _listeners = listeners;
        this.listeners.push([
            builtin_1.onlyShortcuts,
            (0, builtin_1.matchConstraints)(constraints),
            ..._listeners,
        ]);
    }
    action(actionIdOrConstraints, ...listeners) {
        // Normalize Constraints
        const constraints = typeof actionIdOrConstraints === 'string' || node_util_1.default.types.isRegExp(actionIdOrConstraints)
            ? { action_id: actionIdOrConstraints }
            : actionIdOrConstraints;
        // Fail early if the constraints contain invalid keys
        const unknownConstraintKeys = Object.keys(constraints).filter((k) => k !== 'action_id' && k !== 'block_id' && k !== 'callback_id' && k !== 'type');
        if (unknownConstraintKeys.length > 0) {
            // TODO:event() will throw an error if you provide an invalid event name; we should align this behaviour.
            this.logger.error(`Action listener cannot be attached using unknown constraint keys: ${unknownConstraintKeys.join(', ')}`);
            return;
        }
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        const _listeners = listeners;
        this.listeners.push([builtin_1.onlyActions, (0, builtin_1.matchConstraints)(constraints), ..._listeners]);
    }
    command(commandName, ...listeners) {
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        const _listeners = listeners;
        this.listeners.push([
            builtin_1.onlyCommands,
            (0, builtin_1.matchCommandName)(commandName),
            ..._listeners,
        ]);
    }
    // TODO: reflect the type in constraints to Source
    options(actionIdOrConstraints, ...listeners) {
        const constraints = typeof actionIdOrConstraints === 'string' || node_util_1.default.types.isRegExp(actionIdOrConstraints)
            ? { action_id: actionIdOrConstraints }
            : actionIdOrConstraints;
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        const _listeners = listeners;
        this.listeners.push([builtin_1.onlyOptions, (0, builtin_1.matchConstraints)(constraints), ..._listeners]);
    }
    view(callbackIdOrConstraints, ...listeners) {
        const constraints = typeof callbackIdOrConstraints === 'string' || node_util_1.default.types.isRegExp(callbackIdOrConstraints)
            ? { callback_id: callbackIdOrConstraints, type: 'view_submission' }
            : callbackIdOrConstraints;
        // Fail early if the constraints contain invalid keys
        const unknownConstraintKeys = Object.keys(constraints).filter((k) => k !== 'callback_id' && k !== 'type');
        if (unknownConstraintKeys.length > 0) {
            this.logger.error(`View listener cannot be attached using unknown constraint keys: ${unknownConstraintKeys.join(', ')}`);
            return;
        }
        if (constraints.type !== undefined && !validViewTypes.includes(constraints.type)) {
            this.logger.error(`View listener cannot be attached using unknown view event type: ${constraints.type}`);
            return;
        }
        // biome-ignore lint/suspicious/noExplicitAny: FIXME: workaround for TypeScript 4.7 breaking changes
        const _listeners = listeners;
        this.listeners.push([
            builtin_1.onlyViewActions,
            (0, builtin_1.matchConstraints)(constraints),
            ..._listeners,
        ]);
    }
    error(errorHandler) {
        this.errorHandler = errorHandler;
        this.hasCustomErrorHandler = true;
    }
    /**
     * Handles events from the receiver
     */
    async processEvent(event) {
        const { body, ack } = event;
        if (this.developerMode) {
            // log the body of the event
            // this may contain sensitive info like tokens
            this.logger.debug(JSON.stringify(body));
        }
        // TODO: when generating errors (such as in the say utility) it may become useful to capture the current context,
        // or even all of the args, as properties of the error. This would give error handling code some ability to deal
        // with "finally" type error situations.
        // Introspect the body to determine what type of incoming event is being handled, and any channel context
        const { type, conversationId } = (0, helpers_1.getTypeAndConversation)(body);
        // If the type could not be determined, warn and exit
        if (type === undefined) {
            this.logger.warn('Could not determine the type of an incoming event. No listeners will be called.');
            return;
        }
        // From this point on, we assume that body is not just a key-value map, but one of the types of bodies we expect
        const bodyArg = body;
        // Check if type event with the authorizations object or if it has a top level is_enterprise_install property
        const isEnterpriseInstall = (0, helpers_1.isBodyWithTypeEnterpriseInstall)(bodyArg, type);
        const source = buildSource(type, conversationId, bodyArg, isEnterpriseInstall);
        let authorizeResult;
        if (type === helpers_1.IncomingEventType.Event && (0, helpers_1.isEventTypeToSkipAuthorize)(event)) {
            authorizeResult = {
                enterpriseId: source.enterpriseId,
                teamId: source.teamId,
            };
        }
        else {
            try {
                authorizeResult = await this.authorize(source, bodyArg);
            }
            catch (error) {
                // biome-ignore lint/suspicious/noExplicitAny: errors can be anything
                const e = error;
                this.logger.warn('Authorization of incoming event did not succeed. No listeners will be called.');
                e.code = errors_1.ErrorCode.AuthorizationError;
                return this.handleError({
                    error: e,
                    logger: this.logger,
                    body: bodyArg,
                    context: {
                        isEnterpriseInstall,
                    },
                });
            }
        }
        // Try to set userId from AuthorizeResult before using one from source
        if (authorizeResult.userId === undefined && source.userId !== undefined) {
            authorizeResult.userId = source.userId;
        }
        // Try to set teamId from AuthorizeResult before using one from source
        if (authorizeResult.teamId === undefined && source.teamId !== undefined) {
            authorizeResult.teamId = source.teamId;
        }
        // Try to set enterpriseId from AuthorizeResult before using one from source
        if (authorizeResult.enterpriseId === undefined && source.enterpriseId !== undefined) {
            authorizeResult.enterpriseId = source.enterpriseId;
        }
        if (typeof event.customProperties !== 'undefined') {
            const customProps = event.customProperties;
            const builtinKeyDetected = types_1.contextBuiltinKeys.find((key) => key in customProps);
            if (typeof builtinKeyDetected !== 'undefined') {
                throw new errors_1.InvalidCustomPropertyError('customProperties cannot have the same names with the built-in ones');
            }
        }
        const context = {
            ...authorizeResult,
            ...event.customProperties,
            isEnterpriseInstall,
            retryNum: event.retryNum,
            retryReason: event.retryReason,
        };
        // Extract function-related information and augment context
        const { functionExecutionId, functionBotAccessToken, functionInputs } = extractFunctionContext(body);
        if (functionExecutionId) {
            context.functionExecutionId = functionExecutionId;
            if (functionInputs) {
                context.functionInputs = functionInputs;
            }
            if (functionBotAccessToken) {
                context.functionBotAccessToken = functionBotAccessToken;
            }
        }
        // Factory for say() utility
        // TODO: could this be move out of processEvent, use the same token from below or perhaps even a client from the pool
        const createSay = (channelId) => {
            const token = selectToken(context, this.attachFunctionToken);
            return (message) => {
                let postMessageArguments;
                if (typeof message === 'string') {
                    postMessageArguments = { token, text: message, channel: channelId };
                }
                else {
                    postMessageArguments = { ...message, token, channel: channelId };
                }
                return this.client.chat.postMessage(postMessageArguments);
            };
        };
        // Set body and payload
        // TODO: this value should eventually conform to AnyMiddlewareArgs
        // TODO: remove workflow step stuff in bolt v5
        // TODO: can we instead use type predicates in these switch cases to allow for narrowing of the body simultaneously? we have isEvent, isView, isShortcut, isAction already in types/utilities / helpers
        let payload;
        switch (type) {
            case helpers_1.IncomingEventType.Event:
                payload = bodyArg.event;
                break;
            case helpers_1.IncomingEventType.ViewAction:
                payload = bodyArg.view;
                break;
            case helpers_1.IncomingEventType.Shortcut:
                payload = bodyArg;
                break;
            // biome-ignore lint/suspicious/noFallthroughSwitchClause: usually not great, but we do it here
            case helpers_1.IncomingEventType.Action:
                if (isBlockActionOrInteractiveMessageBody(bodyArg)) {
                    const { actions } = bodyArg;
                    [payload] = actions;
                    break;
                }
            // If above conditional does not hit, fall through to fallback payload in default block below
            default:
                payload = bodyArg;
                break;
        }
        // NOTE: the following doesn't work because... distributive?
        // const listenerArgs: Partial<AnyMiddlewareArgs> = {
        const listenerArgs = {
            body: bodyArg,
            payload,
        };
        // Get the client arg
        let { client } = this;
        const token = selectToken(context, this.attachFunctionToken);
        // TODO: this logic should be isolated and tested according to the expected behavior
        if (token !== undefined) {
            let pool = undefined;
            const clientOptionsCopy = { ...this.clientOptions };
            if (authorizeResult.teamId !== undefined) {
                pool = this.clients[authorizeResult.teamId];
                if (pool === undefined) {
                    pool = this.clients[authorizeResult.teamId] = new WebClientPool();
                }
                // Add teamId to clientOptions so it can be automatically added to web-api calls
                clientOptionsCopy.teamId = authorizeResult.teamId;
            }
            else if (authorizeResult.enterpriseId !== undefined) {
                pool = this.clients[authorizeResult.enterpriseId];
                if (pool === undefined) {
                    pool = this.clients[authorizeResult.enterpriseId] = new WebClientPool();
                }
            }
            if (this.attachFunctionToken && context.functionBotAccessToken) {
                // workflow tokens are always unique, they should not be added to the pool
                client = new web_api_1.WebClient(token, clientOptionsCopy);
            }
            else if (pool !== undefined) {
                client = pool.getOrCreate(token, clientOptionsCopy);
            }
        }
        // TODO: can we instead use type predicates in these switch cases to allow for narrowing of the body simultaneously? we have isEvent, isView, isShortcut, isAction already in types/utilities / helpers
        // Set aliases
        if (type === helpers_1.IncomingEventType.Event) {
            // TODO: assigning eventListenerArgs by reference to set properties of listenerArgs is error prone, there should be a better way to do this!
            const eventListenerArgs = listenerArgs;
            eventListenerArgs.event = eventListenerArgs.payload;
            if (eventListenerArgs.event.type === 'message') {
                const messageEventListenerArgs = eventListenerArgs;
                messageEventListenerArgs.message = messageEventListenerArgs.payload;
            }
            // Add complete() and fail() utilities for function-related interactivity
            if (eventListenerArgs.event.type === 'function_executed') {
                listenerArgs.complete = (0, CustomFunction_1.createFunctionComplete)(context, client);
                listenerArgs.fail = (0, CustomFunction_1.createFunctionFail)(context, client);
                listenerArgs.inputs = eventListenerArgs.event.inputs;
            }
        }
        else if (type === helpers_1.IncomingEventType.Action) {
            const actionListenerArgs = listenerArgs;
            actionListenerArgs.action = actionListenerArgs.payload;
            // Add complete() and fail() utilities for function-related interactivity
            if (context.functionExecutionId !== undefined) {
                listenerArgs.complete = (0, CustomFunction_1.createFunctionComplete)(context, client);
                listenerArgs.fail = (0, CustomFunction_1.createFunctionFail)(context, client);
                listenerArgs.inputs = context.functionInputs;
            }
        }
        else if (type === helpers_1.IncomingEventType.Command) {
            const commandListenerArgs = listenerArgs;
            commandListenerArgs.command = commandListenerArgs.payload;
        }
        else if (type === helpers_1.IncomingEventType.Options) {
            const optionListenerArgs = listenerArgs;
            optionListenerArgs.options = optionListenerArgs.payload;
        }
        else if (type === helpers_1.IncomingEventType.ViewAction) {
            const viewListenerArgs = listenerArgs;
            viewListenerArgs.view = viewListenerArgs.payload;
        }
        else if (type === helpers_1.IncomingEventType.Shortcut) {
            const shortcutListenerArgs = listenerArgs;
            shortcutListenerArgs.shortcut = shortcutListenerArgs.payload;
        }
        // Set say() utility
        if (conversationId !== undefined && type !== helpers_1.IncomingEventType.Options) {
            listenerArgs.say = createSay(conversationId);
        }
        // Set respond() utility
        if (body.response_url) {
            listenerArgs.respond = buildRespondFn(this.axios, body.response_url);
        }
        else if (typeof body.response_urls !== 'undefined' && body.response_urls.length > 0) {
            // This can exist only when view_submission payloads - response_url_enabled: true
            listenerArgs.respond = buildRespondFn(this.axios, body.response_urls[0].response_url);
        }
        // Set ack() utility
        if (type !== helpers_1.IncomingEventType.Event) {
            listenerArgs.ack = ack;
        }
        else {
            const eventListenerArgs = listenerArgs;
            if (eventListenerArgs.event?.type === 'function_executed') {
                listenerArgs.ack = ack;
            }
            else {
                // Events API requests are acknowledged right away, since there's no data expected
                // Except function_executed events since ack can be handled by the user
                await ack();
            }
        }
        // Dispatch event through the global middleware chain
        try {
            await (0, process_1.default)(this.middleware, listenerArgs, context, client, this.logger, async () => {
                // Dispatch the event through the listener middleware chains and aggregate their results
                // TODO: change the name of this.middleware and this.listeners to help this make more sense
                const listenerResults = this.listeners.map(async (origListenerMiddleware) => {
                    // Copy the array so modifications don't affect the original
                    const listenerMiddleware = [...origListenerMiddleware];
                    // Don't process the last item in the listenerMiddleware array - it will be passed a no-op next fn
                    const listener = listenerMiddleware.pop();
                    if (listener === undefined) {
                        return undefined;
                    }
                    return (0, process_1.default)(listenerMiddleware, listenerArgs, context, client, this.logger, 
                    // When all the listener middleware are done processing,
                    // `listener` here will be called with a noop `next` fn
                    async () => listener({
                        ...listenerArgs,
                        context,
                        client,
                        logger: this.logger,
                        next: () => { },
                    }));
                });
                const settledListenerResults = await Promise.allSettled(listenerResults);
                const rejectedListenerResults = settledListenerResults.filter(utilities_1.isRejected);
                if (rejectedListenerResults.length === 1) {
                    throw rejectedListenerResults[0].reason;
                    // biome-ignore lint/style/noUselessElse: I think this is a biome issue actually...
                }
                else if (rejectedListenerResults.length > 1) {
                    throw new errors_1.MultipleListenerError(rejectedListenerResults.map((rlr) => rlr.reason));
                }
            });
        }
        catch (error) {
            // biome-ignore lint/suspicious/noExplicitAny: errors can be anything
            const e = error;
            return this.handleError({
                context,
                error: e,
                logger: this.logger,
                body: bodyArg,
            });
        }
    }
    /**
     * Global error handler. The final destination for all errors (hopefully).
     */
    handleError(args) {
        const { error, ...rest } = args;
        return this.extendedErrorHandler && this.hasCustomErrorHandler
            ? this.errorHandler({ error: (0, errors_1.asCodedError)(error), ...rest })
            : this.errorHandler((0, errors_1.asCodedError)(error));
    }
    // ---------------------
    // Private methods for initialization
    // ---------------------
    initReceiver(receiver, signingSecret, endpoints, port, customRoutes, processBeforeResponse, signatureVerification, clientId, clientSecret, stateSecret, redirectUri, installationStore, scopes, appToken, logger) {
        if (receiver !== undefined) {
            // Custom receiver supplied
            if (this.socketMode === true && !(receiver instanceof SocketModeReceiver_1.default)) {
                throw new errors_1.AppInitializationError('You cannot supply a custom receiver when socketMode is set to true.');
            }
            return receiver;
        }
        if (this.socketMode === true) {
            if (appToken === undefined) {
                throw new errors_1.AppInitializationError('You must provide an appToken when socketMode is set to true. To generate an appToken see: https://api.slack.com/apis/connections/socket#token');
            }
            this.logger.debug('Initializing SocketModeReceiver');
            return new SocketModeReceiver_1.default({
                appToken,
                clientId,
                clientSecret,
                stateSecret,
                redirectUri,
                installationStore,
                scopes,
                logger,
                logLevel: this.logLevel,
                installerOptions: this.installerOptions,
                customRoutes,
            });
        }
        if (signatureVerification === true && signingSecret === undefined) {
            // Using default receiver HTTPReceiver, signature verification enabled, missing signingSecret
            throw new errors_1.AppInitializationError('signingSecret is required to initialize the default receiver. Set signingSecret or use a ' +
                'custom receiver. You can find your Signing Secret in your Slack App Settings.');
        }
        this.logger.debug('Initializing HTTPReceiver');
        return new HTTPReceiver_1.default({
            signingSecret: signingSecret || '',
            endpoints,
            port,
            customRoutes,
            processBeforeResponse,
            signatureVerification,
            clientId,
            clientSecret,
            stateSecret,
            redirectUri,
            installationStore,
            scopes,
            logger,
            logLevel: this.logLevel,
            installerOptions: this.installerOptions,
        });
    }
    initAuthorizeIfNoTokenIsGiven(token, authorize) {
        let usingOauth = false;
        const httpReceiver = this.receiver;
        if (httpReceiver.installer !== undefined && httpReceiver.installer.authorize !== undefined) {
            // This supports using the built-in HTTPReceiver, declaring your own HTTPReceiver
            // and theoretically, doing a fully custom (non-Express.js) receiver that implements OAuth
            usingOauth = true;
        }
        if (token !== undefined) {
            if (usingOauth || authorize !== undefined) {
                throw new errors_1.AppInitializationError(`You cannot provide a token along with either oauth installer options or authorize. ${tokenUsage}`);
            }
            return undefined;
        }
        if (authorize === undefined && !usingOauth) {
            throw new errors_1.AppInitializationError(`${tokenUsage} \n\nSince you have not provided a token or authorize, you might be missing one or more required oauth installer options. See https://tools.slack.dev/bolt-js/concepts/authenticating-oauth/ for these required fields.\n`);
            // biome-ignore lint/style/noUselessElse: I think this is a biome issue actually...
        }
        else if (authorize !== undefined && usingOauth) {
            throw new errors_1.AppInitializationError(`You cannot provide both authorize and oauth installer options. ${tokenUsage}`);
            // biome-ignore lint/style/noUselessElse: I think this is a biome issue actually...
        }
        else if (authorize === undefined && usingOauth) {
            // biome-ignore lint/style/noNonNullAssertion: we know installer is truthy here
            return httpReceiver.installer.authorize;
            // biome-ignore lint/style/noUselessElse: I think this is a biome issue actually...
        }
        else if (authorize !== undefined && !usingOauth) {
            return authorize;
        }
        return undefined;
    }
    initAuthorizeInConstructor(token, authorize, authorization) {
        const initializedAuthorize = this.initAuthorizeIfNoTokenIsGiven(token, authorize);
        if (initializedAuthorize !== undefined) {
            return initializedAuthorize;
        }
        if (token !== undefined && authorization !== undefined) {
            return singleAuthorization(this.client, authorization, this.tokenVerificationEnabled);
        }
        const hasToken = token !== undefined && token.length > 0;
        const errorMessage = `Something has gone wrong in #initAuthorizeInConstructor method (hasToken: ${hasToken}, authorize: ${authorize}). Please report this issue to the maintainers. https://github.com/slackapi/bolt-js/issues`;
        this.logger.error(errorMessage);
        throw new Error(errorMessage);
    }
}
exports.default = App;
function defaultErrorHandler(logger) {
    return (error) => {
        logger.error(error);
        return Promise.reject(error);
    };
}
// -----------
// singleAuthorization
function runAuthTestForBotToken(client, authorization) {
    // TODO: warn when something needed isn't found
    return authorization.botUserId !== undefined && authorization.botId !== undefined
        ? Promise.resolve({ botUserId: authorization.botUserId, botId: authorization.botId })
        : client.auth.test({ token: authorization.botToken }).then((result) => ({
            botUserId: result.user_id,
            botId: result.bot_id,
        }));
}
async function buildAuthorizeResult(isEnterpriseInstall, authTestResult, authorization) {
    return { isEnterpriseInstall, botToken: authorization.botToken, ...(await authTestResult) };
}
function singleAuthorization(client, authorization, tokenVerificationEnabled) {
    // As Authorize function has a reference to this local variable,
    // this local variable can behave as auth.test call result cache for the function
    let cachedAuthTestResult;
    if (tokenVerificationEnabled) {
        // call auth.test immediately
        cachedAuthTestResult = runAuthTestForBotToken(client, authorization);
        return async ({ isEnterpriseInstall }) => buildAuthorizeResult(isEnterpriseInstall, cachedAuthTestResult, authorization);
    }
    return async ({ isEnterpriseInstall }) => {
        // hold off calling auth.test API until the first access to authorize function
        cachedAuthTestResult = runAuthTestForBotToken(client, authorization);
        return buildAuthorizeResult(isEnterpriseInstall, cachedAuthTestResult, authorization);
    };
}
// ----------------------------
// For processEvent method
/**
 * Helper which builds the data structure the authorize hook uses to provide tokens for the context.
 */
function buildSource(type, channelId, body, isEnterpriseInstall) {
    // NOTE: potentially something that can be optimized, so that each of these conditions isn't evaluated more than once.
    // if this makes it prettier, great! but we should probably check perf before committing to any specific optimization.
    const teamId = (() => {
        if (type === helpers_1.IncomingEventType.Event) {
            const bodyAsEvent = body;
            if (Array.isArray(bodyAsEvent.authorizations) &&
                bodyAsEvent.authorizations[0] !== undefined &&
                bodyAsEvent.authorizations[0].team_id !== null) {
                return bodyAsEvent.authorizations[0].team_id;
            }
            return bodyAsEvent.team_id;
        }
        if (type === helpers_1.IncomingEventType.Command) {
            return body.team_id;
        }
        const parseTeamId = (bodyAs) => {
            // When the app is installed using org-wide deployment, team property will be null
            if (typeof bodyAs.team !== 'undefined' && bodyAs.team !== null) {
                return bodyAs.team.id;
            }
            // This is the only place where this function might return undefined
            return bodyAs.user.team_id;
        };
        if (type === helpers_1.IncomingEventType.ViewAction) {
            // view_submission/closed payloads can have `view.app_installed_team_id` when a modal view that was opened
            // in a different workspace via some operations inside a Slack Connect channel.
            const bodyAsView = body;
            if (bodyAsView.view.app_installed_team_id) {
                return bodyAsView.view.app_installed_team_id;
            }
            return parseTeamId(bodyAsView);
        }
        if (type === helpers_1.IncomingEventType.Action ||
            type === helpers_1.IncomingEventType.Options ||
            type === helpers_1.IncomingEventType.Shortcut) {
            const bodyAsActionOrOptionsOrShortcut = body;
            return parseTeamId(bodyAsActionOrOptionsOrShortcut);
        }
        return (0, helpers_1.assertNever)(type);
    })();
    const enterpriseId = (() => {
        if (type === helpers_1.IncomingEventType.Event) {
            const bodyAsEvent = body;
            if (Array.isArray(bodyAsEvent.authorizations) && bodyAsEvent.authorizations[0] !== undefined) {
                // The enterprise_id here can be null when the workspace is not in an Enterprise Grid
                const theId = bodyAsEvent.authorizations[0].enterprise_id;
                return theId !== null ? theId : undefined;
            }
            return bodyAsEvent.enterprise_id;
        }
        if (type === helpers_1.IncomingEventType.Command) {
            return body.enterprise_id;
        }
        if (type === helpers_1.IncomingEventType.Action ||
            type === helpers_1.IncomingEventType.Options ||
            type === helpers_1.IncomingEventType.ViewAction ||
            type === helpers_1.IncomingEventType.Shortcut) {
            // NOTE: no type system backed exhaustiveness check within this group of incoming event types
            const bodyAsActionOrOptionsOrViewActionOrShortcut = body;
            if (typeof bodyAsActionOrOptionsOrViewActionOrShortcut.enterprise !== 'undefined' &&
                bodyAsActionOrOptionsOrViewActionOrShortcut.enterprise !== null) {
                return bodyAsActionOrOptionsOrViewActionOrShortcut.enterprise.id;
            }
            // When the app is installed using org-wide deployment, team property will be null
            if (typeof bodyAsActionOrOptionsOrViewActionOrShortcut.team !== 'undefined' &&
                bodyAsActionOrOptionsOrViewActionOrShortcut.team !== null) {
                return bodyAsActionOrOptionsOrViewActionOrShortcut.team.enterprise_id;
            }
            return undefined;
        }
        return (0, helpers_1.assertNever)(type);
    })();
    const userId = (() => {
        if (type === helpers_1.IncomingEventType.Event) {
            // NOTE: no type system backed exhaustiveness check within this incoming event type
            const { event } = body;
            if ('user' in event) {
                if (typeof event.user === 'string') {
                    return event.user;
                }
                if (typeof event.user === 'object') {
                    return event.user.id;
                }
            }
            if ('channel' in event && typeof event.channel !== 'string' && 'creator' in event.channel) {
                return event.channel.creator;
            }
            if ('subteam' in event && event.subteam.created_by !== undefined) {
                return event.subteam.created_by;
            }
            return undefined;
        }
        if (type === helpers_1.IncomingEventType.Action ||
            type === helpers_1.IncomingEventType.Options ||
            type === helpers_1.IncomingEventType.ViewAction ||
            type === helpers_1.IncomingEventType.Shortcut) {
            // NOTE: no type system backed exhaustiveness check within this incoming event type
            const bodyAsActionOrOptionsOrViewActionOrShortcut = body;
            return bodyAsActionOrOptionsOrViewActionOrShortcut.user.id;
        }
        if (type === helpers_1.IncomingEventType.Command) {
            return body.user_id;
        }
        return (0, helpers_1.assertNever)(type);
    })();
    return {
        userId,
        isEnterpriseInstall,
        teamId: teamId,
        enterpriseId: enterpriseId,
        conversationId: channelId,
    };
}
function isBlockActionOrInteractiveMessageBody(body) {
    return body.actions !== undefined;
}
// Returns either a bot token, a user token or a workflow token for client, say()
function selectToken(context, attachFunctionToken) {
    if (attachFunctionToken && context.functionBotAccessToken) {
        return context.functionBotAccessToken;
    }
    return context.botToken !== undefined ? context.botToken : context.userToken;
}
function buildRespondFn(axiosInstance, responseUrl) {
    return async (message) => {
        const normalizedArgs = typeof message === 'string' ? { text: message } : message;
        return axiosInstance.post(responseUrl, normalizedArgs);
    };
}
function escapeHtml(input) {
    if (input) {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }
    return '';
}
function extractFunctionContext(body) {
    let functionExecutionId = undefined;
    let functionBotAccessToken = undefined;
    let functionInputs = undefined;
    // function_executed event
    if (body.event && body.event.type === 'function_executed' && body.event.function_execution_id) {
        functionExecutionId = body.event.function_execution_id;
        functionBotAccessToken = body.event.bot_access_token;
        functionInputs = body.event.inputs;
    }
    // interactivity (block_actions)
    if (body.function_data) {
        functionExecutionId = body.function_data.execution_id;
        functionBotAccessToken = body.bot_access_token;
        functionInputs = body.function_data.inputs;
    }
    return { functionExecutionId, functionBotAccessToken, functionInputs };
}
// ----------------------------
// Instrumentation
// Don't change the position of the following code
(0, web_api_1.addAppMetadata)({ name: packageJson.name, version: packageJson.version });
//# sourceMappingURL=App.js.map