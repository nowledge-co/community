/// <reference types="node" />
import { type ServerResponse } from 'node:http';
import { LogLevel, type Logger } from '@slack/logger';
import { type CallbackOptions, type InstallPathOptions, InstallProvider, type InstallProviderOptions, type InstallURLOptions } from '@slack/oauth';
import { SocketModeClient } from '@slack/socket-mode';
import type { AppsConnectionsOpenResponse } from '@slack/web-api';
import type App from '../App';
import type { Receiver } from '../types';
import type { StringIndexed } from '../types/utilities';
import type { ParamsIncomingMessage } from './ParamsIncomingMessage';
import { type SocketModeReceiverProcessEventErrorHandlerArgs } from './SocketModeFunctions';
export interface SocketModeReceiverOptions {
    logger?: Logger;
    logLevel?: LogLevel;
    clientId?: string;
    clientSecret?: string;
    stateSecret?: InstallProviderOptions['stateSecret'];
    redirectUri?: string;
    installationStore?: InstallProviderOptions['installationStore'];
    scopes?: InstallURLOptions['scopes'];
    installerOptions?: InstallerOptions;
    appToken: string;
    customRoutes?: CustomRoute[];
    customPropertiesExtractor?: (args: any) => StringIndexed;
    processEventErrorHandler?: (args: SocketModeReceiverProcessEventErrorHandlerArgs) => Promise<boolean>;
}
export interface CustomRoute {
    path: string;
    method: string | string[];
    handler: (req: ParamsIncomingMessage, res: ServerResponse) => void;
}
interface InstallerOptions {
    stateStore?: InstallProviderOptions['stateStore'];
    stateVerification?: InstallProviderOptions['stateVerification'];
    legacyStateVerification?: InstallProviderOptions['legacyStateVerification'];
    stateCookieName?: InstallProviderOptions['stateCookieName'];
    stateCookieExpirationSeconds?: InstallProviderOptions['stateCookieExpirationSeconds'];
    authVersion?: InstallProviderOptions['authVersion'];
    metadata?: InstallURLOptions['metadata'];
    installPath?: string;
    directInstall?: boolean;
    renderHtmlForInstallPath?: InstallProviderOptions['renderHtmlForInstallPath'];
    redirectUriPath?: string;
    installPathOptions?: InstallPathOptions;
    callbackOptions?: CallbackOptions;
    userScopes?: InstallURLOptions['userScopes'];
    clientOptions?: InstallProviderOptions['clientOptions'];
    authorizationUrl?: InstallProviderOptions['authorizationUrl'];
    port?: number;
}
/**
 * Receives Events, Slash Commands, and Actions of a web socket connection
 */
export default class SocketModeReceiver implements Receiver {
    client: SocketModeClient;
    private app;
    private logger;
    installer: InstallProvider | undefined;
    private httpServer?;
    private httpServerPort?;
    private routes;
    private processEventErrorHandler;
    constructor({ appToken, logger, logLevel, clientId, clientSecret, stateSecret, redirectUri, installationStore, scopes, installerOptions, customRoutes, customPropertiesExtractor, processEventErrorHandler, }: SocketModeReceiverOptions);
    init(app: App): void;
    start(): Promise<AppsConnectionsOpenResponse>;
    stop(): Promise<void>;
}
export {};
//# sourceMappingURL=SocketModeReceiver.d.ts.map