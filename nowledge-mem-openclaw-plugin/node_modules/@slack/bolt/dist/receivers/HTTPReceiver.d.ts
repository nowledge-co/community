/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { type RequestListener, type Server, type ServerOptions } from 'node:http';
import { type Server as HTTPSServer, type ServerOptions as HTTPSServerOptions } from 'node:https';
import type { ListenOptions } from 'node:net';
import { LogLevel, type Logger } from '@slack/logger';
import { type CallbackOptions, type InstallPathOptions, InstallProvider, type InstallProviderOptions, type InstallURLOptions } from '@slack/oauth';
import type App from '../App';
import type { Receiver } from '../types';
import type { StringIndexed } from '../types/utilities';
import type { BufferedIncomingMessage } from './BufferedIncomingMessage';
import * as httpFunc from './HTTPModuleFunctions';
import { type CustomRoute } from './custom-routes';
export interface HTTPReceiverOptions {
    signingSecret: string;
    endpoints?: string | string[];
    port?: number;
    customRoutes?: CustomRoute[];
    logger?: Logger;
    logLevel?: LogLevel;
    processBeforeResponse?: boolean;
    signatureVerification?: boolean;
    clientId?: string;
    clientSecret?: string;
    stateSecret?: InstallProviderOptions['stateSecret'];
    redirectUri?: string;
    installationStore?: InstallProviderOptions['installationStore'];
    scopes?: InstallURLOptions['scopes'];
    installerOptions?: HTTPReceiverInstallerOptions;
    customPropertiesExtractor?: (request: BufferedIncomingMessage) => StringIndexed;
    dispatchErrorHandler?: (args: httpFunc.ReceiverDispatchErrorHandlerArgs) => void;
    processEventErrorHandler?: (args: httpFunc.ReceiverProcessEventErrorHandlerArgs) => Promise<boolean>;
    unhandledRequestHandler?: (args: httpFunc.ReceiverUnhandledRequestHandlerArgs) => void;
    unhandledRequestTimeoutMillis?: number;
}
export interface HTTPReceiverInstallerOptions {
    installPath?: string;
    directInstall?: InstallProviderOptions['directInstall'];
    renderHtmlForInstallPath?: InstallProviderOptions['renderHtmlForInstallPath'];
    redirectUriPath?: string;
    stateStore?: InstallProviderOptions['stateStore'];
    stateVerification?: InstallProviderOptions['stateVerification'];
    legacyStateVerification?: InstallProviderOptions['legacyStateVerification'];
    stateCookieName?: InstallProviderOptions['stateCookieName'];
    stateCookieExpirationSeconds?: InstallProviderOptions['stateCookieExpirationSeconds'];
    authVersion?: InstallProviderOptions['authVersion'];
    clientOptions?: InstallProviderOptions['clientOptions'];
    authorizationUrl?: InstallProviderOptions['authorizationUrl'];
    metadata?: InstallURLOptions['metadata'];
    userScopes?: InstallURLOptions['userScopes'];
    installPathOptions?: InstallPathOptions;
    callbackOptions?: CallbackOptions;
    port?: number;
}
/**
 * Receives HTTP requests with Events, Slash Commands, and Actions
 */
export default class HTTPReceiver implements Receiver {
    private endpoints;
    private port;
    private routes;
    private signingSecret;
    private processBeforeResponse;
    private signatureVerification;
    private app?;
    requestListener: RequestListener;
    private server?;
    installer?: InstallProvider;
    private installPath?;
    private installRedirectUriPath?;
    private installUrlOptions?;
    private installPathOptions?;
    private installCallbackOptions?;
    private stateVerification?;
    private logger;
    private customPropertiesExtractor;
    private dispatchErrorHandler;
    private processEventErrorHandler;
    private unhandledRequestHandler;
    private unhandledRequestTimeoutMillis;
    constructor({ signingSecret, endpoints, port, customRoutes, logger, logLevel, processBeforeResponse, signatureVerification, clientId, clientSecret, stateSecret, redirectUri, installationStore, scopes, installerOptions, customPropertiesExtractor, dispatchErrorHandler, processEventErrorHandler, unhandledRequestHandler, unhandledRequestTimeoutMillis, }: HTTPReceiverOptions);
    init(app: App): void;
    start(port: number): Promise<Server>;
    start(port: string): Promise<Server>;
    start(portOrListenOptions: number | string | ListenOptions, serverOptions?: ServerOptions): Promise<Server>;
    start(portOrListenOptions: number | string | ListenOptions, httpsServerOptions?: HTTPSServerOptions): Promise<HTTPSServer>;
    stop(): Promise<void>;
    private unboundRequestListener;
    private handleIncomingEvent;
    private handleInstallPathRequest;
    private handleInstallRedirectRequest;
}
//# sourceMappingURL=HTTPReceiver.d.ts.map