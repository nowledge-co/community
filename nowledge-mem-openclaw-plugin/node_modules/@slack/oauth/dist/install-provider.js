"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InstallProvider = void 0;
var node_url_1 = require("node:url");
var web_api_1 = require("@slack/web-api");
var callback_options_1 = require("./callback-options");
var default_render_html_for_install_path_1 = __importDefault(require("./default-render-html-for-install-path"));
var errors_1 = require("./errors");
var installation_stores_1 = require("./installation-stores");
var logger_1 = require("./logger");
var state_stores_1 = require("./state-stores");
/**
 * InstallProvider Class. Refer to InsallProviderOptions interface for the details of constructor arguments.
 */
var InstallProvider = /** @class */ (function () {
    function InstallProvider(_a) {
        var clientId = _a.clientId, clientSecret = _a.clientSecret, _b = _a.stateSecret, stateSecret = _b === void 0 ? undefined : _b, _c = _a.stateStore, stateStore = _c === void 0 ? undefined : _c, _d = _a.stateVerification, stateVerification = _d === void 0 ? true : _d, 
        // this option is only for the backward-compatibility with v2.4 and older
        _e = _a.legacyStateVerification, 
        // this option is only for the backward-compatibility with v2.4 and older
        legacyStateVerification = _e === void 0 ? false : _e, _f = _a.stateCookieName, stateCookieName = _f === void 0 ? 'slack-app-oauth-state' : _f, _g = _a.stateCookieExpirationSeconds, stateCookieExpirationSeconds = _g === void 0 ? 600 : _g, // 10 minutes
        _h = _a.directInstall, // 10 minutes
        directInstall = _h === void 0 ? false : _h, _j = _a.installationStore, installationStore = _j === void 0 ? new installation_stores_1.MemoryInstallationStore() : _j, 
        // If installURLOptions is undefined here, handleInstallPath() does not work for you
        _k = _a.installUrlOptions, 
        // If installURLOptions is undefined here, handleInstallPath() does not work for you
        installUrlOptions = _k === void 0 ? undefined : _k, _l = _a.renderHtmlForInstallPath, renderHtmlForInstallPath = _l === void 0 ? default_render_html_for_install_path_1.default : _l, _m = _a.authVersion, authVersion = _m === void 0 ? 'v2' : _m, _o = _a.logger, logger = _o === void 0 ? undefined : _o, _p = _a.logLevel, logLevel = _p === void 0 ? undefined : _p, _q = _a.clientOptions, clientOptions = _q === void 0 ? {} : _q, _r = _a.authorizationUrl, authorizationUrl = _r === void 0 ? 'https://slack.com/oauth/v2/authorize' : _r;
        if (clientId === undefined || clientSecret === undefined) {
            throw new errors_1.InstallerInitializationError('You must provide a valid clientId and clientSecret');
        }
        // Setup the logger
        if (typeof logger !== 'undefined') {
            this.logger = logger;
            if (typeof logLevel !== 'undefined') {
                this.logger.debug('The logLevel given to OAuth was ignored as you also gave logger');
            }
        }
        else {
            this.logger = (0, logger_1.getLogger)('OAuth:InstallProvider', logLevel !== null && logLevel !== void 0 ? logLevel : logger_1.LogLevel.INFO, logger);
        }
        this.stateVerification = stateVerification;
        this.legacyStateVerification = legacyStateVerification;
        this.stateCookieName = stateCookieName;
        this.stateCookieExpirationSeconds = stateCookieExpirationSeconds;
        this.directInstall = directInstall;
        if (!stateVerification) {
            this.logger.warn("You've set InstallProvider#stateVerification to false. This flag is intended to enable org-wide app installations from admin pages. If this isn't your scenario, we recommend setting stateVerification to true and starting your OAuth flow from the provided `/slack/install` or your own starting endpoint.");
        }
        // Setup stateStore
        if (stateStore !== undefined) {
            this.stateStore = stateStore;
        }
        else if (this.stateVerification) {
            // if state verification is disabled, state store is not necessary
            if (stateSecret !== undefined) {
                this.stateStore = new state_stores_1.ClearStateStore(stateSecret, this.stateCookieExpirationSeconds);
            }
            else {
                throw new errors_1.InstallerInitializationError('To use the built-in state store you must provide a State Secret');
            }
        }
        this.installationStore = installationStore;
        this.installUrlOptions = installUrlOptions;
        this.renderHtmlForInstallPath = renderHtmlForInstallPath;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.handleCallback = this.handleCallback.bind(this);
        this.authorize = this.authorize.bind(this);
        this.authVersion = authVersion;
        this.authorizationUrl = authorizationUrl;
        if (authorizationUrl !== 'https://slack.com/oauth/v2/authorize' && authVersion === 'v1') {
            this.logger.info('You provided both an authorizationUrl and an authVersion! The authVersion will be ignored in favor of the authorizationUrl.');
        }
        else if (authVersion === 'v1') {
            this.authorizationUrl = 'https://slack.com/oauth/authorize';
        }
        this.clientOptions = __assign({ logger: logger, logLevel: this.logger.getLevel() }, clientOptions);
        this.noTokenClient = new web_api_1.WebClient(undefined, this.clientOptions);
    }
    // ------------------------------------------------------
    // Handling incoming requests from Slack API servers
    // ------------------------------------------------------
    /**
     * Fetches data from the installationStore
     */
    InstallProvider.prototype.authorize = function (source) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceForLogging, queryResult, authResult, currentUTCSec, tokensToRefresh, errorMessage, refreshResponses, installationUpdates, _i, refreshResponses_1, refreshResp, tokenType, botOrUser, errorMessage, error_1;
            var _a, _b, _c, _d;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        sourceForLogging = JSON.stringify(source);
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 7, 8, 9]);
                        this.logger.debug("Starting authorize() execution (source: ".concat(sourceForLogging, ")"));
                        return [4 /*yield*/, this.installationStore.fetchInstallation(source, this.logger)];
                    case 2:
                        queryResult = _e.sent();
                        if (queryResult === undefined || queryResult === null) {
                            throw new Error("Failed fetching data from the Installation Store (source: ".concat(sourceForLogging, ")"));
                        }
                        authResult = {};
                        if (queryResult.user) {
                            authResult.userToken = queryResult.user.token;
                        }
                        if ((_a = queryResult.team) === null || _a === void 0 ? void 0 : _a.id) {
                            authResult.teamId = queryResult.team.id;
                        }
                        else if (source === null || source === void 0 ? void 0 : source.teamId) {
                            /**
                             * Since queryResult is a org installation, it won't have team.id.
                             * If one was passed in via source, we should add it to the authResult.
                             */
                            authResult.teamId = source.teamId;
                        }
                        if (((_b = queryResult === null || queryResult === void 0 ? void 0 : queryResult.enterprise) === null || _b === void 0 ? void 0 : _b.id) || (source === null || source === void 0 ? void 0 : source.enterpriseId)) {
                            authResult.enterpriseId = ((_c = queryResult === null || queryResult === void 0 ? void 0 : queryResult.enterprise) === null || _c === void 0 ? void 0 : _c.id) || (source === null || source === void 0 ? void 0 : source.enterpriseId);
                        }
                        if (queryResult.bot) {
                            authResult.botToken = queryResult.bot.token;
                            authResult.botId = queryResult.bot.id;
                            authResult.botUserId = queryResult.bot.userId;
                            // Token Rotation Enabled (Bot Token)
                            if (queryResult.bot.refreshToken) {
                                authResult.botRefreshToken = queryResult.bot.refreshToken;
                                authResult.botTokenExpiresAt = queryResult.bot.expiresAt; // utc, seconds
                            }
                        }
                        // Token Rotation Enabled (User Token)
                        if ((_d = queryResult.user) === null || _d === void 0 ? void 0 : _d.refreshToken) {
                            authResult.userRefreshToken = queryResult.user.refreshToken;
                            authResult.userTokenExpiresAt = queryResult.user.expiresAt; // utc, seconds
                        }
                        if (!(authResult.botRefreshToken || authResult.userRefreshToken)) return [3 /*break*/, 6];
                        currentUTCSec = Math.floor(Date.now() / 1000);
                        tokensToRefresh = detectExpiredOrExpiringTokens(authResult, currentUTCSec);
                        if (!(tokensToRefresh.length > 0)) return [3 /*break*/, 6];
                        if (queryResult.authVersion !== 'v2') {
                            errorMessage = 'Unexpected data structure detected. ' +
                                'The data returned by your InstallationStore#fetchInstallation() method must have "authVersion": "v2" ' +
                                'if it has a refresh token';
                            throw new errors_1.UnknownError(errorMessage);
                        }
                        return [4 /*yield*/, this.refreshExpiringTokens(tokensToRefresh)];
                    case 3:
                        refreshResponses = _e.sent();
                        if (!refreshResponses.length) return [3 /*break*/, 5];
                        installationUpdates = __assign({}, queryResult);
                        for (_i = 0, refreshResponses_1 = refreshResponses; _i < refreshResponses_1.length; _i++) {
                            refreshResp = refreshResponses_1[_i];
                            tokenType = refreshResp.token_type;
                            // Update Authorization
                            if (tokenType === 'bot') {
                                authResult.botToken = refreshResp.access_token;
                                authResult.botRefreshToken = refreshResp.refresh_token;
                                authResult.botTokenExpiresAt = currentUTCSec + refreshResp.expires_in;
                            }
                            if (tokenType === 'user') {
                                authResult.userToken = refreshResp.access_token;
                                authResult.userRefreshToken = refreshResp.refresh_token;
                                authResult.userTokenExpiresAt = currentUTCSec + refreshResp.expires_in;
                            }
                            botOrUser = installationUpdates[tokenType];
                            if (botOrUser !== undefined) {
                                this.logger.debug("Saving ".concat(tokenType, " token and its refresh token in InstallationStore"));
                                botOrUser.token = refreshResp.access_token;
                                botOrUser.refreshToken = refreshResp.refresh_token;
                                botOrUser.expiresAt = currentUTCSec + refreshResp.expires_in;
                            }
                            else {
                                errorMessage = "Unexpected data structure detected. The data returned by your InstallationStore#fetchInstallation() method must have ".concat(tokenType, " at top-level");
                                throw new errors_1.UnknownError(errorMessage);
                            }
                        }
                        return [4 /*yield*/, this.installationStore.storeInstallation(installationUpdates)];
                    case 4:
                        _e.sent();
                        this.logger.debug('Refreshed tokens have been saved in InstallationStore');
                        return [3 /*break*/, 6];
                    case 5:
                        this.logger.debug('No tokens were refreshed');
                        _e.label = 6;
                    case 6: return [2 /*return*/, authResult];
                    case 7:
                        error_1 = _e.sent();
                        // biome-ignore lint/suspicious/noExplicitAny: errors can be any
                        throw new errors_1.AuthorizationError(error_1.message);
                    case 8:
                        this.logger.debug("Completed authorize() execution (source: ".concat(sourceForLogging, ")"));
                        return [7 /*endfinally*/];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * refreshExpiringTokens refreshes expired access tokens using the `oauth.v2.access` endpoint.
     *
     * The return value is an Array of Promises made up of the resolution of each token refresh attempt.
     */
    InstallProvider.prototype.refreshExpiringTokens = function (tokensToRefresh) {
        return __awaiter(this, void 0, void 0, function () {
            var refreshPromises;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        refreshPromises = tokensToRefresh.map(function (token) { return _this.refreshExpiringToken(token); });
                        return [4 /*yield*/, Promise.all(refreshPromises)];
                    case 1: return [2 /*return*/, (_a.sent())
                            .filter(function (res) { return !(res instanceof Error); })
                            .map(function (res) { return res; })];
                }
            });
        });
    };
    InstallProvider.prototype.refreshExpiringToken = function (refreshToken) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                return [2 /*return*/, this.noTokenClient.oauth.v2
                        .access({
                        client_id: this.clientId,
                        client_secret: this.clientSecret,
                        grant_type: 'refresh_token',
                        refresh_token: refreshToken,
                    })
                        .then(function (res) { return res; })
                        .catch(function (e) {
                        _this.logger.error("Failed to perform oauth.v2.access API call for token rotation: (error: ".concat(e, ")"));
                        return e; // this one will be filtered out later
                    })];
            });
        });
    };
    // ------------------------------------------------------
    // Handling web browser requests from end-users
    // ------------------------------------------------------
    /**
     * Handles the install path (the default is /slack/install) requests from an app installer.
     */
    InstallProvider.prototype.handleInstallPath = function (req, res, options, installOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var errorMessage, _installOptions, _printableOptions, shouldProceed, state, stateCookie, existingCookies, allCookies, url, body, e_1, message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (installOptions === undefined && this.installUrlOptions === undefined) {
                            errorMessage = 'To enable the built-in install path handler, you need to pass InstallURLOptions to InstallProvider. ' +
                                "If you're using @slack/bolt, please upgrade the framework to the latest version.";
                            throw new errors_1.GenerateInstallUrlError(errorMessage);
                        }
                        _installOptions = installOptions || this.installUrlOptions;
                        _printableOptions = JSON.stringify(_installOptions);
                        this.logger.debug("Running handleInstallPath() with ".concat(_printableOptions));
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, , 9]);
                        shouldProceed = true;
                        if (!((options === null || options === void 0 ? void 0 : options.beforeRedirection) !== undefined)) return [3 /*break*/, 3];
                        return [4 /*yield*/, options.beforeRedirection(req, res, installOptions)];
                    case 2:
                        shouldProceed = _a.sent();
                        _a.label = 3;
                    case 3:
                        if (!shouldProceed) {
                            this.logger.debug('Skipped to proceed with the built-in redirection as beforeRedirection returned false');
                            return [2 /*return*/];
                        }
                        state = void 0;
                        if (!this.stateVerification) return [3 /*break*/, 6];
                        if (!this.stateStore) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.stateStore.generateStateParam(_installOptions, new Date())];
                    case 4:
                        state = _a.sent();
                        stateCookie = this.buildSetCookieHeaderForNewState(state);
                        if (res.getHeader('Set-Cookie')) {
                            existingCookies = res.getHeader('Set-Cookie') || [];
                            allCookies = [];
                            if (Array.isArray(existingCookies)) {
                                allCookies.push.apply(allCookies, existingCookies);
                            }
                            else if (typeof existingCookies === 'string') {
                                allCookies.push(existingCookies);
                            }
                            else {
                                allCookies.push(existingCookies.toString());
                            }
                            // Append the state cookie
                            allCookies.push(stateCookie);
                            res.setHeader('Set-Cookie', allCookies);
                        }
                        else {
                            res.setHeader('Set-Cookie', stateCookie);
                        }
                        return [3 /*break*/, 6];
                    case 5:
                        if (this.stateStore === undefined) {
                            throw new errors_1.GenerateInstallUrlError('StateStore is not properly configured');
                        }
                        _a.label = 6;
                    case 6: return [4 /*yield*/, this.generateInstallUrl(_installOptions, this.stateVerification, state)];
                    case 7:
                        url = _a.sent();
                        this.logger.debug("Generated authorize URL: ".concat(url));
                        if (this.directInstall !== undefined && this.directInstall) {
                            // If a Slack app sets "Direct Install URL" in the Slack app configruation,
                            // the installation flow of the app should start with the Slack authorize URL.
                            // See https://docs.slack.dev/slack-marketplace/distributing-your-app-in-the-slack-marketplace for more details.
                            res.setHeader('Location', url);
                            res.writeHead(302);
                            res.end('');
                        }
                        else {
                            body = this.renderHtmlForInstallPath(url);
                            // Serve a basic HTML page including the "Add to Slack" button.
                            // Regarding headers:
                            // - Content-Length is not used because Transfer-Encoding='chunked' is automatically used.
                            res.setHeader('Content-Type', 'text/html; charset=utf-8');
                            res.writeHead(200);
                            res.end(body);
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        e_1 = _a.sent();
                        message = "An unhandled error occurred while processing an install path request (error: ".concat(e_1, ")");
                        this.logger.error(message);
                        // biome-ignore lint/suspicious/noExplicitAny: errors can be any
                        throw new errors_1.GenerateInstallUrlError(e_1.message);
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Returns a URL that is suitable for including in an Add to Slack button
     * Uses stateStore to generate a value for the state query param.
     */
    InstallProvider.prototype.generateInstallUrl = function (options_1) {
        return __awaiter(this, arguments, void 0, function (options, stateVerification, state) {
            var slackURL, scopes, params, _state, errorMessage, userScopes;
            if (stateVerification === void 0) { stateVerification = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        slackURL = new node_url_1.URL(this.authorizationUrl);
                        if (options.scopes === undefined || options.scopes === null) {
                            throw new errors_1.GenerateInstallUrlError('You must provide a scope parameter when calling generateInstallUrl');
                        }
                        if (Array.isArray(options.scopes)) {
                            scopes = options.scopes.join(',');
                        }
                        else {
                            scopes = options.scopes;
                        }
                        params = new node_url_1.URLSearchParams("scope=".concat(scopes));
                        if (!stateVerification) return [3 /*break*/, 4];
                        _state = state;
                        if (!(_state === undefined)) return [3 /*break*/, 3];
                        if (!this.stateStore) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.stateStore.generateStateParam(options, new Date())];
                    case 1:
                        _state = _a.sent();
                        return [3 /*break*/, 3];
                    case 2:
                        errorMessage = 'StateStore needs to be set for generating a valid authorize URL';
                        throw new errors_1.InstallerInitializationError(errorMessage);
                    case 3:
                        params.append('state', _state);
                        _a.label = 4;
                    case 4:
                        // client id
                        params.append('client_id', this.clientId);
                        // redirect uri
                        if (options.redirectUri !== undefined) {
                            params.append('redirect_uri', options.redirectUri);
                        }
                        // team id
                        if (options.teamId !== undefined) {
                            params.append('team', options.teamId);
                        }
                        // user scope, only available for OAuth v2
                        if (options.userScopes !== undefined && this.authVersion === 'v2') {
                            userScopes = void 0;
                            if (Array.isArray(options.userScopes)) {
                                userScopes = options.userScopes.join(',');
                            }
                            else {
                                userScopes = options.userScopes;
                            }
                            params.append('user_scope', userScopes);
                        }
                        slackURL.search = params.toString();
                        return [2 /*return*/, slackURL.toString()];
                }
            });
        });
    };
    /**
     * This method handles the incoming request to the callback URL.
     * It can be used as a RequestListener in almost any HTTP server
     * framework.
     *
     * Verifies the state using the stateStore, exchanges the grant in the
     * query params for an access token, and stores token and associated data
     * in the installationStore.
     */
    InstallProvider.prototype.handleCallback = function (req, res, options, installOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var code, flowError, stateInQueryString, searchParams, stateInBrowserSession, emptyInstallOptions, shouldProceed, installation, resp, v1Resp, v1Installation, authResult, botId, v2Resp, v2Installation, currentUTC, authResult, authResult, error_2, emptyInstallOptions, codedError;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 27, , 32]);
                        if (req.url !== undefined) {
                            searchParams = extractSearchParams(req);
                            flowError = searchParams.get('error');
                            if (flowError === 'access_denied') {
                                throw new errors_1.AuthorizationError('User cancelled the OAuth installation flow!');
                            }
                            code = searchParams.get('code');
                            stateInQueryString = searchParams.get('state');
                            if (!code) {
                                throw new errors_1.MissingCodeError('Redirect url is missing the required code query parameter');
                            }
                            if (this.stateVerification && !stateInQueryString) {
                                throw new errors_1.MissingStateError('Redirect url is missing the state query parameter. If this is intentional, see options for disabling default state verification.');
                            }
                        }
                        else {
                            throw new errors_1.UnknownError('Something went wrong');
                        }
                        if (!this.stateVerification) return [3 /*break*/, 6];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 5, 6]);
                        if (this.legacyStateVerification) {
                            // This mode is not enabled by default
                            // This option is for some of the existing developers that need time for migration
                            this.logger.warn('Enabling legacyStateVerification is not recommended as it does not properly work for OAuth CSRF protection. Please consider migrating from directly using InstallProvider#generateInstallUrl() to InstallProvider#handleInstallPath() for serving the install path.');
                        }
                        else {
                            stateInBrowserSession = extractCookieValue(req, this.stateCookieName);
                            if (!stateInBrowserSession || stateInBrowserSession !== stateInQueryString) {
                                throw new errors_1.InvalidStateError('The state parameter is not for this browser session.');
                            }
                        }
                        if (!this.stateStore) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.stateStore.verifyStateParam(new Date(), stateInQueryString)];
                    case 2:
                        // biome-ignore lint/style/noParameterAssign: we reassigning, deal with it
                        installOptions = _b.sent();
                        return [3 /*break*/, 4];
                    case 3: throw new errors_1.InstallerInitializationError('StateStore is not properly configured');
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        // Delete the state value in cookies in any case
                        res.setHeader('Set-Cookie', this.buildSetCookieHeaderForStateDeletion());
                        return [7 /*endfinally*/];
                    case 6:
                        if (!installOptions) {
                            emptyInstallOptions = { scopes: [] };
                            // biome-ignore lint/style/noParameterAssign: we reassigning, deal with it
                            installOptions = emptyInstallOptions;
                        }
                        shouldProceed = true;
                        if (!((options === null || options === void 0 ? void 0 : options.beforeInstallation) !== undefined)) return [3 /*break*/, 8];
                        return [4 /*yield*/, options.beforeInstallation(installOptions, req, res)];
                    case 7:
                        shouldProceed = _b.sent();
                        _b.label = 8;
                    case 8:
                        if (!shouldProceed) {
                            // When options.beforeInstallation returns false,
                            // the app installation is cancelled
                            // The beforeInstallation method is responsible for building a complete HTTP response.
                            return [2 /*return*/];
                        }
                        installation = void 0;
                        resp = void 0;
                        if (!(this.authVersion === 'v1')) return [3 /*break*/, 12];
                        return [4 /*yield*/, this.noTokenClient.oauth.access({
                                code: code,
                                client_id: this.clientId,
                                client_secret: this.clientSecret,
                                redirect_uri: installOptions.redirectUri,
                            })];
                    case 9:
                        v1Resp = (_b.sent());
                        v1Installation = {
                            team: { id: v1Resp.team_id, name: v1Resp.team_name },
                            enterprise: v1Resp.enterprise_id === null ? undefined : { id: v1Resp.enterprise_id },
                            user: {
                                token: v1Resp.access_token,
                                scopes: v1Resp.scope.split(','),
                                id: v1Resp.user_id,
                            },
                            // synthesized properties: enterprise installation is unsupported in v1 auth
                            isEnterpriseInstall: false,
                            authVersion: 'v1',
                        };
                        if (!(v1Resp.bot !== undefined)) return [3 /*break*/, 11];
                        return [4 /*yield*/, runAuthTest(v1Resp.bot.bot_access_token, this.clientOptions)];
                    case 10:
                        authResult = _b.sent();
                        botId = authResult.bot_id;
                        v1Installation.bot = {
                            id: botId,
                            scopes: ['bot'],
                            token: v1Resp.bot.bot_access_token,
                            userId: v1Resp.bot.bot_user_id,
                        };
                        _b.label = 11;
                    case 11:
                        resp = v1Resp;
                        installation = v1Installation;
                        return [3 /*break*/, 19];
                    case 12: return [4 /*yield*/, this.noTokenClient.oauth.v2.access({
                            code: code,
                            client_id: this.clientId,
                            client_secret: this.clientSecret,
                            redirect_uri: installOptions.redirectUri,
                        })];
                    case 13:
                        v2Resp = (_b.sent());
                        v2Installation = {
                            team: v2Resp.team === null ? undefined : v2Resp.team,
                            enterprise: v2Resp.enterprise == null ? undefined : v2Resp.enterprise,
                            user: {
                                token: v2Resp.authed_user.access_token,
                                scopes: (_a = v2Resp.authed_user.scope) === null || _a === void 0 ? void 0 : _a.split(','),
                                id: v2Resp.authed_user.id,
                            },
                            tokenType: v2Resp.token_type,
                            isEnterpriseInstall: v2Resp.is_enterprise_install,
                            appId: v2Resp.app_id,
                            // synthesized properties
                            authVersion: 'v2',
                        };
                        currentUTC = Math.floor(Date.now() / 1000);
                        if (!(v2Resp.access_token !== undefined && v2Resp.scope !== undefined && v2Resp.bot_user_id !== undefined)) return [3 /*break*/, 15];
                        return [4 /*yield*/, runAuthTest(v2Resp.access_token, this.clientOptions)];
                    case 14:
                        authResult = _b.sent();
                        v2Installation.bot = {
                            scopes: v2Resp.scope.split(','),
                            token: v2Resp.access_token,
                            userId: v2Resp.bot_user_id,
                            id: authResult.bot_id,
                        };
                        if (v2Resp.is_enterprise_install) {
                            v2Installation.enterpriseUrl = authResult.url;
                        }
                        // Token Rotation is Enabled
                        if (v2Resp.refresh_token !== undefined && v2Resp.expires_in !== undefined) {
                            v2Installation.bot.refreshToken = v2Resp.refresh_token;
                            v2Installation.bot.expiresAt = currentUTC + v2Resp.expires_in; // utc, seconds
                        }
                        _b.label = 15;
                    case 15:
                        if (!(v2Resp.authed_user !== undefined && v2Resp.authed_user.access_token !== undefined)) return [3 /*break*/, 18];
                        if (!(v2Resp.is_enterprise_install && v2Installation.enterpriseUrl === undefined)) return [3 /*break*/, 17];
                        return [4 /*yield*/, runAuthTest(v2Resp.authed_user.access_token, this.clientOptions)];
                    case 16:
                        authResult = _b.sent();
                        v2Installation.enterpriseUrl = authResult.url;
                        _b.label = 17;
                    case 17:
                        // Token Rotation is Enabled
                        if (v2Resp.authed_user.refresh_token !== undefined && v2Resp.authed_user.expires_in !== undefined) {
                            v2Installation.user.refreshToken = v2Resp.authed_user.refresh_token;
                            v2Installation.user.expiresAt = currentUTC + v2Resp.authed_user.expires_in; // utc, seconds
                        }
                        _b.label = 18;
                    case 18:
                        resp = v2Resp;
                        installation = v2Installation;
                        _b.label = 19;
                    case 19:
                        if (resp.incoming_webhook !== undefined) {
                            installation.incomingWebhook = {
                                url: resp.incoming_webhook.url,
                                channel: resp.incoming_webhook.channel,
                                channelId: resp.incoming_webhook.channel_id,
                                configurationUrl: resp.incoming_webhook.configuration_url,
                            };
                        }
                        if (installOptions && installOptions.metadata !== undefined) {
                            // Pass the metadata in state parameter if exists.
                            // Developers can use the value for additional/custom data associated with the installation.
                            installation.metadata = installOptions.metadata;
                        }
                        if (!((options === null || options === void 0 ? void 0 : options.afterInstallation) !== undefined)) return [3 /*break*/, 21];
                        return [4 /*yield*/, options.afterInstallation(installation, installOptions, req, res)];
                    case 20:
                        shouldProceed = _b.sent();
                        _b.label = 21;
                    case 21:
                        if (!shouldProceed) {
                            // When options.beforeInstallation returns false,
                            // the app installation is cancelled
                            // The afterInstallation method is responsible for building a complete HTTP response.
                            return [2 /*return*/];
                        }
                        // Save installation object to installation store
                        return [4 /*yield*/, this.installationStore.storeInstallation(installation, this.logger)];
                    case 22:
                        // Save installation object to installation store
                        _b.sent();
                        if (!(options !== undefined && (options.success !== undefined || options.successAsync !== undefined))) return [3 /*break*/, 25];
                        if (options.success !== undefined) {
                            this.logger.debug('Calling passed function as callbackOptions.success');
                            options.success(installation, installOptions, req, res);
                        }
                        if (!(options.successAsync !== undefined)) return [3 /*break*/, 24];
                        this.logger.debug('Calling passed function as callbackOptions.successAsync');
                        return [4 /*yield*/, options.successAsync(installation, installOptions, req, res)];
                    case 23:
                        _b.sent();
                        _b.label = 24;
                    case 24: return [3 /*break*/, 26];
                    case 25:
                        this.logger.debug('Running built-in success function');
                        (0, callback_options_1.defaultCallbackSuccess)(installation, installOptions, req, res);
                        _b.label = 26;
                    case 26: return [3 /*break*/, 32];
                    case 27:
                        error_2 = _b.sent();
                        this.logger.error(error_2);
                        if (!installOptions) {
                            emptyInstallOptions = { scopes: [] };
                            // biome-ignore lint/style/noParameterAssign: we reassigning, deal with it
                            installOptions = emptyInstallOptions;
                        }
                        codedError = error_2;
                        if (codedError.code === undefined) {
                            codedError.code = errors_1.ErrorCode.UnknownError;
                        }
                        if (!(options !== undefined && (options.failure !== undefined || options.failureAsync !== undefined))) return [3 /*break*/, 30];
                        if (options.failure !== undefined) {
                            this.logger.debug('Calling passed function as callbackOptions.failure');
                            options.failure(codedError, installOptions, req, res);
                        }
                        if (!(options.failureAsync !== undefined)) return [3 /*break*/, 29];
                        this.logger.debug('Calling passed function as callbackOptions.failureAsync');
                        return [4 /*yield*/, options.failureAsync(codedError, installOptions, req, res)];
                    case 28:
                        _b.sent();
                        _b.label = 29;
                    case 29: return [3 /*break*/, 31];
                    case 30:
                        this.logger.debug('Running built-in failure function');
                        (0, callback_options_1.defaultCallbackFailure)(codedError, installOptions, req, res);
                        _b.label = 31;
                    case 31: return [3 /*break*/, 32];
                    case 32: return [2 /*return*/];
                }
            });
        });
    };
    // -----------------------
    // Internal methods
    InstallProvider.prototype.buildSetCookieHeaderForNewState = function (state) {
        var name = this.stateCookieName;
        var maxAge = this.stateCookieExpirationSeconds;
        return "".concat(name, "=").concat(state, "; Secure; HttpOnly; Path=/; Max-Age=").concat(maxAge);
    };
    InstallProvider.prototype.buildSetCookieHeaderForStateDeletion = function () {
        var name = this.stateCookieName;
        return "".concat(name, "=deleted; Secure; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    };
    return InstallProvider;
}());
exports.InstallProvider = InstallProvider;
function runAuthTest(token, clientOptions) {
    return __awaiter(this, void 0, void 0, function () {
        var client, authResult;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    client = new web_api_1.WebClient(token, clientOptions);
                    return [4 /*yield*/, client.auth.test({})];
                case 1:
                    authResult = _a.sent();
                    return [2 /*return*/, authResult];
            }
        });
    });
}
/**
 * detectExpiredOrExpiringTokens determines access tokens' eligibility for refresh.
 *
 * The return value is an Array of expired or soon-to-expire access tokens.
 */
function detectExpiredOrExpiringTokens(authResult, currentUTCSec) {
    var tokensToRefresh = [];
    var EXPIRY_WINDOW = 7200; // 2 hours
    if (authResult.botRefreshToken &&
        authResult.botTokenExpiresAt !== undefined &&
        authResult.botTokenExpiresAt !== null) {
        var botTokenExpiresIn = authResult.botTokenExpiresAt - currentUTCSec;
        if (botTokenExpiresIn <= EXPIRY_WINDOW) {
            tokensToRefresh.push(authResult.botRefreshToken);
        }
    }
    if (authResult.userRefreshToken &&
        authResult.userTokenExpiresAt !== undefined &&
        authResult.userTokenExpiresAt !== null) {
        var userTokenExpiresIn = authResult.userTokenExpiresAt - currentUTCSec;
        if (userTokenExpiresIn <= EXPIRY_WINDOW) {
            tokensToRefresh.push(authResult.userRefreshToken);
        }
    }
    return tokensToRefresh;
}
/**
 * Returns search params from a URL and ignores protocol / hostname as those
 * aren't guaranteed to be accurate e.g. in x-forwarded- scenarios
 */
function extractSearchParams(req) {
    var searchParams = new node_url_1.URL(req.url, "https://".concat(req.headers.host)).searchParams;
    return searchParams;
}
function extractCookieValue(req, name) {
    var allCookies = req.headers.cookie;
    if (allCookies) {
        var found = allCookies.split(';').find(function (c) { return c.trim().startsWith("".concat(name, "=")); });
        if (found) {
            return found.split('=')[1].trim();
        }
    }
    return undefined;
}
//# sourceMappingURL=install-provider.js.map