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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildBodyParserMiddleware = exports.verifySignatureAndParseBody = exports.verifySignatureAndParseRawBody = exports.respondToUrlVerification = exports.respondToSslCheck = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const node_querystring_1 = __importDefault(require("node:querystring"));
const logger_1 = require("@slack/logger");
const oauth_1 = require("@slack/oauth");
const express_1 = __importStar(require("express"));
const raw_body_1 = __importDefault(require("raw-body"));
const tsscmp_1 = __importDefault(require("tsscmp"));
const errors_1 = require("../errors");
const httpFunc = __importStar(require("./HTTPModuleFunctions"));
const HTTPResponseAck_1 = require("./HTTPResponseAck");
const verify_redirect_opts_1 = require("./verify-redirect-opts");
// Option keys for tls.createServer() and tls.createSecureContext(), exclusive of those for http.createServer()
const httpsOptionKeys = [
    'ALPNProtocols',
    'clientCertEngine',
    'enableTrace',
    'handshakeTimeout',
    'rejectUnauthorized',
    'requestCert',
    'sessionTimeout',
    'SNICallback',
    'ticketKeys',
    'pskCallback',
    'pskIdentityHint',
    'ca',
    'cert',
    'sigalgs',
    'ciphers',
    'clientCertEngine',
    'crl',
    'dhparam',
    'ecdhCurve',
    'honorCipherOrder',
    'key',
    'privateKeyEngine',
    'privateKeyIdentifier',
    'maxVersion',
    'minVersion',
    'passphrase',
    'pfx',
    'secureOptions',
    'secureProtocol',
    'sessionIdContext',
];
const missingServerErrorDescription = 'The receiver cannot be started because private state was mutated. Please report this to the maintainers.';
const respondToSslCheck = (req, res, next) => {
    if (req.body?.ssl_check) {
        res.send();
        return;
    }
    next();
};
exports.respondToSslCheck = respondToSslCheck;
const respondToUrlVerification = (req, res, next) => {
    if (req.body?.type && req.body.type === 'url_verification') {
        res.json({ challenge: req.body.challenge });
        return;
    }
    next();
};
exports.respondToUrlVerification = respondToUrlVerification;
/**
 * Receives HTTP requests with Events, Slash Commands, and Actions
 */
class ExpressReceiver {
    /* Express app */
    app;
    server;
    bolt;
    logger;
    processBeforeResponse;
    signatureVerification;
    router;
    installer = undefined;
    installerOptions;
    customPropertiesExtractor;
    dispatchErrorHandler;
    processEventErrorHandler;
    unhandledRequestHandler;
    unhandledRequestTimeoutMillis;
    constructor({ signingSecret = '', logger = undefined, logLevel = logger_1.LogLevel.INFO, endpoints = { events: '/slack/events' }, processBeforeResponse = false, signatureVerification = true, clientId = undefined, clientSecret = undefined, stateSecret = undefined, redirectUri = undefined, installationStore = undefined, scopes = undefined, installerOptions = {}, app = undefined, router = undefined, customPropertiesExtractor = (_req) => ({}), dispatchErrorHandler = httpFunc.defaultAsyncDispatchErrorHandler, processEventErrorHandler = httpFunc.defaultProcessEventErrorHandler, unhandledRequestHandler = httpFunc.defaultUnhandledRequestHandler, unhandledRequestTimeoutMillis = 3001, }) {
        this.app = app !== undefined ? app : (0, express_1.default)();
        if (typeof logger !== 'undefined') {
            this.logger = logger;
        }
        else {
            this.logger = new logger_1.ConsoleLogger();
            this.logger.setLevel(logLevel);
        }
        this.signatureVerification = signatureVerification;
        const bodyParser = this.signatureVerification
            ? buildVerificationBodyParserMiddleware(this.logger, signingSecret)
            : buildBodyParserMiddleware(this.logger);
        const expressMiddleware = [
            bodyParser,
            exports.respondToSslCheck,
            exports.respondToUrlVerification,
            this.requestHandler.bind(this),
        ];
        this.processBeforeResponse = processBeforeResponse;
        const endpointList = typeof endpoints === 'string' ? [endpoints] : Object.values(endpoints);
        this.router = router !== undefined ? router : (0, express_1.Router)();
        for (const endpoint of endpointList) {
            this.router.post(endpoint, ...expressMiddleware);
        }
        this.customPropertiesExtractor = customPropertiesExtractor;
        this.dispatchErrorHandler = dispatchErrorHandler;
        this.processEventErrorHandler = processEventErrorHandler;
        this.unhandledRequestHandler = unhandledRequestHandler;
        this.unhandledRequestTimeoutMillis = unhandledRequestTimeoutMillis;
        // Verify redirect options if supplied, throws coded error if invalid
        (0, verify_redirect_opts_1.verifyRedirectOpts)({ redirectUri, redirectUriPath: installerOptions.redirectUriPath });
        if (clientId !== undefined &&
            clientSecret !== undefined &&
            (installerOptions.stateVerification === false || // state store not needed
                stateSecret !== undefined ||
                installerOptions.stateStore !== undefined) // user provided state store
        ) {
            this.installer = new oauth_1.InstallProvider({
                clientId,
                clientSecret,
                stateSecret,
                installationStore,
                logLevel,
                logger, // pass logger that was passed in constructor, not one created locally
                directInstall: installerOptions.directInstall,
                stateStore: installerOptions.stateStore,
                stateVerification: installerOptions.stateVerification,
                legacyStateVerification: installerOptions.legacyStateVerification,
                stateCookieName: installerOptions.stateCookieName,
                stateCookieExpirationSeconds: installerOptions.stateCookieExpirationSeconds,
                renderHtmlForInstallPath: installerOptions.renderHtmlForInstallPath,
                authVersion: installerOptions.authVersion ?? 'v2',
                clientOptions: installerOptions.clientOptions,
                authorizationUrl: installerOptions.authorizationUrl,
            });
        }
        // create install url options
        const installUrlOptions = {
            metadata: installerOptions.metadata,
            scopes: scopes ?? [],
            userScopes: installerOptions.userScopes,
            redirectUri,
        };
        // Add OAuth routes to receiver
        if (this.installer !== undefined) {
            const { installer } = this;
            const redirectUriPath = installerOptions.redirectUriPath === undefined ? '/slack/oauth_redirect' : installerOptions.redirectUriPath;
            const { callbackOptions, stateVerification } = installerOptions;
            this.router.use(redirectUriPath, async (req, res) => {
                try {
                    if (stateVerification === false) {
                        // when stateVerification is disabled pass install options directly to handler
                        // since they won't be encoded in the state param of the generated url
                        await installer.handleCallback(req, res, callbackOptions, installUrlOptions);
                    }
                    else {
                        await installer.handleCallback(req, res, callbackOptions);
                    }
                }
                catch (e) {
                    await this.dispatchErrorHandler({
                        error: e,
                        logger: this.logger,
                        request: req,
                        response: res,
                    });
                }
            });
            const installPath = installerOptions.installPath === undefined ? '/slack/install' : installerOptions.installPath;
            const { installPathOptions } = installerOptions;
            this.router.get(installPath, async (req, res, next) => {
                try {
                    try {
                        await installer.handleInstallPath(req, res, installPathOptions, installUrlOptions);
                    }
                    catch (error) {
                        next(error);
                    }
                }
                catch (e) {
                    await this.dispatchErrorHandler({
                        error: e,
                        logger: this.logger,
                        request: req,
                        response: res,
                    });
                }
            });
        }
        this.app.use(this.router);
    }
    async requestHandler(req, res) {
        const ack = new HTTPResponseAck_1.HTTPResponseAck({
            logger: this.logger,
            processBeforeResponse: this.processBeforeResponse,
            unhandledRequestHandler: this.unhandledRequestHandler,
            unhandledRequestTimeoutMillis: this.unhandledRequestTimeoutMillis,
            httpRequest: req,
            httpRequestBody: req.body,
            httpResponse: res,
        });
        const event = {
            body: req.body,
            ack: ack.bind(),
            retryNum: httpFunc.extractRetryNumFromHTTPRequest(req),
            retryReason: httpFunc.extractRetryReasonFromHTTPRequest(req),
            customProperties: this.customPropertiesExtractor(req),
        };
        try {
            await this.bolt?.processEvent(event);
            if (ack.storedResponse !== undefined) {
                httpFunc.buildContentResponse(res, ack.storedResponse);
                this.logger.debug('stored response sent');
            }
        }
        catch (err) {
            const acknowledgedByHandler = await this.processEventErrorHandler({
                error: err,
                logger: this.logger,
                request: req,
                response: res,
                storedResponse: ack.storedResponse,
            });
            if (acknowledgedByHandler) {
                // If the value is false, we don't touch the value as a race condition
                // with ack() call may occur especially when processBeforeResponse: false
                ack.ack();
            }
        }
    }
    init(bolt) {
        this.bolt = bolt;
    }
    start(portOrListenOptions, serverOptions = {}) {
        let createServerFn = node_http_1.createServer;
        // Look for HTTPS-specific serverOptions to determine which factory function to use
        if (Object.keys(serverOptions).filter((k) => httpsOptionKeys.includes(k)).length > 0) {
            createServerFn = node_https_1.createServer;
        }
        if (this.server !== undefined) {
            return Promise.reject(new errors_1.ReceiverInconsistentStateError('The receiver cannot be started because it was already started.'));
        }
        this.server = createServerFn(serverOptions, this.app);
        return new Promise((resolve, reject) => {
            if (this.server === undefined) {
                throw new errors_1.ReceiverInconsistentStateError(missingServerErrorDescription);
            }
            this.server.on('error', (error) => {
                if (this.server === undefined) {
                    throw new errors_1.ReceiverInconsistentStateError(missingServerErrorDescription);
                }
                this.server.close();
                // If the error event occurs before listening completes (like EADDRINUSE), this works well. However, if the
                // error event happens some after the Promise is already resolved, the error would be silently swallowed up.
                // The documentation doesn't describe any specific errors that can occur after listening has started, so this
                // feels safe.
                reject(error);
            });
            this.server.on('close', () => {
                // Not removing all listeners because consumers could have added their own `close` event listener, and those
                // should be called. If the consumer doesn't dispose of any references to the server properly, this would be
                // a memory leak.
                // this.server?.removeAllListeners();
                this.server = undefined;
            });
            this.server.listen(portOrListenOptions, () => {
                if (this.server === undefined) {
                    return reject(new errors_1.ReceiverInconsistentStateError(missingServerErrorDescription));
                }
                return resolve(this.server);
            });
        });
    }
    // TODO: the arguments should be defined as the arguments to close() (which happen to be none), but for sake of
    // generic types
    stop() {
        if (this.server === undefined) {
            return Promise.reject(new errors_1.ReceiverInconsistentStateError('The receiver cannot be stopped because it was not started.'));
        }
        return new Promise((resolve, reject) => {
            this.server?.close((error) => {
                if (error !== undefined) {
                    return reject(error);
                }
                this.server = undefined;
                return resolve();
            });
        });
    }
}
exports.default = ExpressReceiver;
function verifySignatureAndParseRawBody(logger, signingSecret) {
    return buildVerificationBodyParserMiddleware(logger, signingSecret);
}
exports.verifySignatureAndParseRawBody = verifySignatureAndParseRawBody;
/**
 * This request handler has two responsibilities:
 * - Verify the request signature
 * - Parse request.body and assign the successfully parsed object to it.
 */
function buildVerificationBodyParserMiddleware(logger, signingSecret) {
    return async (req, res, next) => {
        // *** Parsing body ***
        // As the verification passed, parse the body as an object and assign it to req.body
        const stringBody = await parseExpressRequestRawBody(req);
        // Following middlewares can expect `req.body` is already parsed.
        try {
            // This handler parses `req.body` or `req.rawBody`(on Google Could Platform)
            // and overwrites `req.body` with the parsed JS object.
            req.body = verifySignatureAndParseBody(typeof signingSecret === 'string' ? signingSecret : await signingSecret(), stringBody, req.headers);
        }
        catch (error) {
            if (error) {
                if (error instanceof errors_1.ReceiverAuthenticityError) {
                    logError(logger, 'Request verification failed', error);
                    res.status(401).send();
                    return;
                }
                logError(logger, 'Parsing request body failed', error);
                res.status(400).send();
                return;
            }
        }
        next();
    };
}
// biome-ignore lint/suspicious/noExplicitAny: errors can be anything
function logError(logger, message, error) {
    const logMessage = 'code' in error ? `${message} (code: ${error.code}, message: ${error.message})` : `${message} (error: ${error})`;
    logger.warn(logMessage);
}
function verifyRequestSignature(signingSecret, body, signature, requestTimestamp) {
    if (signature === undefined || requestTimestamp === undefined) {
        throw new errors_1.ReceiverAuthenticityError('Slack request signing verification failed. Some headers are missing.');
    }
    const ts = Number(requestTimestamp);
    if (Number.isNaN(ts)) {
        throw new errors_1.ReceiverAuthenticityError('Slack request signing verification failed. Timestamp is invalid.');
    }
    // Divide current date to match Slack ts format
    // Subtract 5 minutes from current time
    const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
    if (ts < fiveMinutesAgo) {
        throw new errors_1.ReceiverAuthenticityError('Slack request signing verification failed. Timestamp is too old.');
    }
    const hmac = node_crypto_1.default.createHmac('sha256', signingSecret);
    const [version, hash] = signature.split('=');
    hmac.update(`${version}:${ts}:${body}`);
    if (!(0, tsscmp_1.default)(hash, hmac.digest('hex'))) {
        throw new errors_1.ReceiverAuthenticityError('Slack request signing verification failed. Signature mismatch.');
    }
}
/**
 * This request handler has two responsibilities:
 * - Verify the request signature
 * - Parse `request.body` and assign the successfully parsed object to it.
 */
function verifySignatureAndParseBody(signingSecret, body, 
// biome-ignore lint/suspicious/noExplicitAny: TODO: headers should only be of a certain type, but some other functions here expect a more complicated type. revisit to type properly later.
headers) {
    // *** Request verification ***
    const { 'x-slack-signature': signature, 'x-slack-request-timestamp': requestTimestamp, 'content-type': contentType, } = headers;
    verifyRequestSignature(signingSecret, body, signature, requestTimestamp);
    return parseRequestBody(body, contentType);
}
exports.verifySignatureAndParseBody = verifySignatureAndParseBody;
function buildBodyParserMiddleware(logger) {
    return async (req, res, next) => {
        const stringBody = await parseExpressRequestRawBody(req);
        try {
            const { 'content-type': contentType } = req.headers;
            req.body = parseRequestBody(stringBody, contentType);
        }
        catch (error) {
            if (error) {
                logError(logger, 'Parsing request body failed', error);
                res.status(400).send();
                return;
            }
        }
        next();
    };
}
exports.buildBodyParserMiddleware = buildBodyParserMiddleware;
// biome-ignore lint/suspicious/noExplicitAny: request bodies can be anything
function parseRequestBody(stringBody, contentType) {
    if (contentType === 'application/x-www-form-urlencoded') {
        const parsedBody = node_querystring_1.default.parse(stringBody);
        if (typeof parsedBody.payload === 'string') {
            return JSON.parse(parsedBody.payload);
        }
        return parsedBody;
    }
    return JSON.parse(stringBody);
}
// On some environments like GCP (Google Cloud Platform),
// req.body can be pre-parsed and be passed as req.rawBody
async function parseExpressRequestRawBody(req) {
    if ('rawBody' in req && req.rawBody) {
        return Promise.resolve(req.rawBody.toString());
    }
    return (await (0, raw_body_1.default)(req)).toString();
}
//# sourceMappingURL=ExpressReceiver.js.map