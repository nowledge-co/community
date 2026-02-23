"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const node_url_1 = require("node:url");
const logger_1 = require("@slack/logger");
const oauth_1 = require("@slack/oauth");
const socket_mode_1 = require("@slack/socket-mode");
const path_to_regexp_1 = require("path-to-regexp");
const SocketModeFunctions_1 = require("./SocketModeFunctions");
const SocketModeResponseAck_1 = require("./SocketModeResponseAck");
const custom_routes_1 = require("./custom-routes");
const verify_redirect_opts_1 = require("./verify-redirect-opts");
/**
 * Receives Events, Slash Commands, and Actions of a web socket connection
 */
class SocketModeReceiver {
    /* Express app */
    client;
    app;
    logger;
    installer = undefined;
    httpServer;
    httpServerPort;
    routes;
    processEventErrorHandler;
    constructor({ appToken, logger = undefined, logLevel = logger_1.LogLevel.INFO, clientId = undefined, clientSecret = undefined, stateSecret = undefined, redirectUri = undefined, installationStore = undefined, scopes = undefined, installerOptions = {}, customRoutes = [], customPropertiesExtractor = (_args) => ({}), processEventErrorHandler = SocketModeFunctions_1.defaultProcessEventErrorHandler, }) {
        this.client = new socket_mode_1.SocketModeClient({
            appToken,
            logLevel,
            logger,
            clientOptions: installerOptions.clientOptions,
        });
        this.logger =
            logger ??
                (() => {
                    const defaultLogger = new logger_1.ConsoleLogger();
                    defaultLogger.setLevel(logLevel);
                    return defaultLogger;
                })();
        this.routes = (0, custom_routes_1.buildReceiverRoutes)(customRoutes);
        this.processEventErrorHandler = processEventErrorHandler;
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
                authVersion: installerOptions.authVersion,
                clientOptions: installerOptions.clientOptions,
                authorizationUrl: installerOptions.authorizationUrl,
            });
        }
        // Add OAuth and/or custom routes to receiver
        if (this.installer !== undefined || customRoutes.length) {
            const installPath = installerOptions.installPath === undefined ? '/slack/install' : installerOptions.installPath;
            this.httpServerPort = installerOptions.port === undefined ? 3000 : installerOptions.port;
            this.httpServer = (0, node_http_1.createServer)(async (req, res) => {
                // biome-ignore lint/style/noNonNullAssertion: method should always be defined for an HTTP request right?
                const method = req.method.toUpperCase();
                // Handle OAuth-related requests
                if (this.installer) {
                    // create install url options
                    const installUrlOptions = {
                        metadata: installerOptions.metadata,
                        scopes: scopes ?? [],
                        userScopes: installerOptions.userScopes,
                        redirectUri,
                    };
                    // Installation has been initiated
                    const redirectUriPath = installerOptions.redirectUriPath === undefined ? '/slack/oauth_redirect' : installerOptions.redirectUriPath;
                    if (req.url?.startsWith(redirectUriPath)) {
                        const { stateVerification, callbackOptions } = installerOptions;
                        if (stateVerification === false) {
                            // if stateVerification is disabled make install options available to handler
                            // since they won't be encoded in the state param of the generated url
                            await this.installer.handleCallback(req, res, callbackOptions, installUrlOptions);
                        }
                        else {
                            await this.installer.handleCallback(req, res, callbackOptions);
                        }
                        return;
                    }
                    // Visiting the installation endpoint
                    if (req.url?.startsWith(installPath)) {
                        const { installPathOptions } = installerOptions;
                        await this.installer.handleInstallPath(req, res, installPathOptions, installUrlOptions);
                        return;
                    }
                }
                // Handle request for custom routes
                if (customRoutes.length && req.url) {
                    // NOTE: the domain and scheme are irrelevant here.
                    // The URL object is only used to safely obtain the path to match
                    const { pathname: path } = new node_url_1.URL(req.url, 'http://localhost');
                    const routes = Object.keys(this.routes);
                    for (let i = 0; i < routes.length; i += 1) {
                        const route = routes[i];
                        const matchRegex = (0, path_to_regexp_1.match)(route, { decode: decodeURIComponent });
                        const pathMatch = matchRegex(path);
                        if (pathMatch && this.routes[route][method] !== undefined) {
                            const params = pathMatch.params;
                            const message = Object.assign(req, { params });
                            this.routes[route][method](message, res);
                            return;
                        }
                    }
                }
                this.logger.info(`An unhandled HTTP request (${req.method}) made to ${req.url} was ignored`);
                res.writeHead(404, {});
                res.end();
            });
            this.logger.debug(`Listening for HTTP requests on port ${this.httpServerPort}`);
            if (this.installer) {
                this.logger.debug(`Go to http://localhost:${this.httpServerPort}${installPath} to initiate OAuth flow`);
            }
        }
        this.client.on('slack_event', async (args) => {
            const { body, retry_num, retry_reason } = args;
            const ack = new SocketModeResponseAck_1.SocketModeResponseAck({ logger: this.logger, socketModeClientAck: args.ack });
            const event = {
                body,
                ack: ack.bind(),
                retryNum: retry_num,
                retryReason: retry_reason,
                customProperties: customPropertiesExtractor(args),
            };
            try {
                await this.app?.processEvent(event);
            }
            catch (error) {
                const shouldBeAcked = await this.processEventErrorHandler({
                    error: error,
                    logger: this.logger,
                    event,
                });
                if (shouldBeAcked) {
                    await event.ack();
                }
            }
        });
    }
    init(app) {
        this.app = app;
    }
    start() {
        if (this.httpServer !== undefined) {
            // This HTTP server is only for the OAuth flow support
            this.httpServer.listen(this.httpServerPort);
        }
        // start socket mode client
        return this.client.start();
    }
    stop() {
        if (this.httpServer !== undefined) {
            // This HTTP server is only for the OAuth flow support
            this.httpServer.close((error) => {
                if (error)
                    this.logger.error(`Failed to shutdown the HTTP server for OAuth flow: ${error}`);
            });
        }
        return new Promise((resolve, reject) => {
            try {
                this.client.disconnect();
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    }
}
exports.default = SocketModeReceiver;
//# sourceMappingURL=SocketModeReceiver.js.map