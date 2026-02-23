import type { IncomingMessage, ServerResponse } from 'node:http';
import { type WebAPICallResult } from '@slack/web-api';
import type { AuthorizeResult } from './authorize-result';
import { type CallbackOptions } from './callback-options';
import type { InstallPathOptions } from './install-path-options';
import type { InstallProviderOptions } from './install-provider-options';
import type { InstallURLOptions } from './install-url-options';
import type { InstallationQuery } from './installation-query';
import { type InstallationStore } from './installation-stores';
import { type StateStore } from './state-stores';
/**
 * InstallProvider Class. Refer to InsallProviderOptions interface for the details of constructor arguments.
 */
export declare class InstallProvider {
    stateStore?: StateStore;
    installationStore: InstallationStore;
    private clientId;
    private clientSecret;
    private authVersion;
    private logger;
    private installUrlOptions?;
    private directInstall;
    private renderHtmlForInstallPath;
    private authorizationUrl;
    private stateVerification;
    private legacyStateVerification;
    private stateCookieName;
    private stateCookieExpirationSeconds;
    private clientOptions;
    private noTokenClient;
    constructor({ clientId, clientSecret, stateSecret, stateStore, stateVerification, legacyStateVerification, stateCookieName, stateCookieExpirationSeconds, // 10 minutes
    directInstall, installationStore, installUrlOptions, renderHtmlForInstallPath, authVersion, logger, logLevel, clientOptions, authorizationUrl, }: InstallProviderOptions);
    /**
     * Fetches data from the installationStore
     */
    authorize(source: InstallationQuery<boolean>): Promise<AuthorizeResult>;
    /**
     * refreshExpiringTokens refreshes expired access tokens using the `oauth.v2.access` endpoint.
     *
     * The return value is an Array of Promises made up of the resolution of each token refresh attempt.
     */
    private refreshExpiringTokens;
    private refreshExpiringToken;
    /**
     * Handles the install path (the default is /slack/install) requests from an app installer.
     */
    handleInstallPath(req: IncomingMessage, res: ServerResponse, options?: InstallPathOptions, installOptions?: InstallURLOptions): Promise<void>;
    /**
     * Returns a URL that is suitable for including in an Add to Slack button
     * Uses stateStore to generate a value for the state query param.
     */
    generateInstallUrl(options: InstallURLOptions, stateVerification?: boolean, state?: string): Promise<string>;
    /**
     * This method handles the incoming request to the callback URL.
     * It can be used as a RequestListener in almost any HTTP server
     * framework.
     *
     * Verifies the state using the stateStore, exchanges the grant in the
     * query params for an access token, and stores token and associated data
     * in the installationStore.
     */
    handleCallback(req: IncomingMessage, res: ServerResponse, options?: CallbackOptions, installOptions?: InstallURLOptions): Promise<void>;
    private buildSetCookieHeaderForNewState;
    private buildSetCookieHeaderForStateDeletion;
}
export interface OAuthV2Response extends WebAPICallResult {
    app_id: string;
    authed_user: {
        id: string;
        scope?: string;
        access_token?: string;
        token_type?: string;
        refresh_token?: string;
        expires_in?: number;
    };
    scope?: string;
    token_type?: 'bot';
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    bot_user_id?: string;
    team: {
        id: string;
        name: string;
    } | null;
    enterprise: {
        name: string;
        id: string;
    } | null;
    is_enterprise_install: boolean;
    incoming_webhook?: {
        url: string;
        channel: string;
        channel_id: string;
        configuration_url: string;
    };
}
export interface OAuthV2TokenRefreshResponse extends WebAPICallResult {
    app_id: string;
    scope: string;
    token_type: 'bot' | 'user';
    access_token: string;
    refresh_token: string;
    expires_in: number;
    bot_user_id?: string;
    team: {
        id: string;
        name: string;
    };
    enterprise: {
        name: string;
        id: string;
    } | null;
    is_enterprise_install: boolean;
}
//# sourceMappingURL=install-provider.d.ts.map