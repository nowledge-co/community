/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { type Server, type ServerOptions } from 'node:http';
import { type Server as HTTPSServer, type ServerOptions as HTTPSServerOptions } from 'node:https';
import type { ListenOptions } from 'node:net';
import { LogLevel, type Logger } from '@slack/logger';
import { type CallbackOptions, type InstallPathOptions, InstallProvider, type InstallProviderOptions, type InstallURLOptions } from '@slack/oauth';
import { type Request, type Response, type Application, type RequestHandler, type IRouter } from 'express';
import type App from '../App';
import type { AnyMiddlewareArgs, Receiver } from '../types';
import type { StringIndexed } from '../types/utilities';
import * as httpFunc from './HTTPModuleFunctions';
export declare const respondToSslCheck: RequestHandler;
export declare const respondToUrlVerification: RequestHandler;
export interface ExpressReceiverOptions {
    signingSecret: string | (() => PromiseLike<string>);
    logger?: Logger;
    logLevel?: LogLevel;
    endpoints?: string | {
        [endpointType: string]: string;
    };
    signatureVerification?: boolean;
    processBeforeResponse?: boolean;
    clientId?: string;
    clientSecret?: string;
    stateSecret?: InstallProviderOptions['stateSecret'];
    redirectUri?: string;
    installationStore?: InstallProviderOptions['installationStore'];
    scopes?: InstallURLOptions['scopes'];
    installerOptions?: InstallerOptions;
    app?: Application;
    router?: IRouter;
    customPropertiesExtractor?: (request: Request) => StringIndexed;
    dispatchErrorHandler?: (args: httpFunc.ReceiverDispatchErrorHandlerArgs) => Promise<void>;
    processEventErrorHandler?: (args: httpFunc.ReceiverProcessEventErrorHandlerArgs) => Promise<boolean>;
    unhandledRequestHandler?: (args: httpFunc.ReceiverUnhandledRequestHandlerArgs) => void;
    unhandledRequestTimeoutMillis?: number;
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
    directInstall?: InstallProviderOptions['directInstall'];
    renderHtmlForInstallPath?: InstallProviderOptions['renderHtmlForInstallPath'];
    redirectUriPath?: string;
    installPathOptions?: InstallPathOptions;
    callbackOptions?: CallbackOptions;
    userScopes?: InstallURLOptions['userScopes'];
    clientOptions?: InstallProviderOptions['clientOptions'];
    authorizationUrl?: InstallProviderOptions['authorizationUrl'];
}
/**
 * Receives HTTP requests with Events, Slash Commands, and Actions
 */
export default class ExpressReceiver implements Receiver {
    app: Application;
    private server?;
    private bolt;
    private logger;
    private processBeforeResponse;
    private signatureVerification;
    router: IRouter;
    installer: InstallProvider | undefined;
    installerOptions?: InstallerOptions;
    private customPropertiesExtractor;
    private dispatchErrorHandler;
    private processEventErrorHandler;
    private unhandledRequestHandler;
    private unhandledRequestTimeoutMillis;
    constructor({ signingSecret, logger, logLevel, endpoints, processBeforeResponse, signatureVerification, clientId, clientSecret, stateSecret, redirectUri, installationStore, scopes, installerOptions, app, router, customPropertiesExtractor, dispatchErrorHandler, processEventErrorHandler, unhandledRequestHandler, unhandledRequestTimeoutMillis, }: ExpressReceiverOptions);
    requestHandler(req: Request, res: Response): Promise<void>;
    init(bolt: App): void;
    start(port: number): Promise<Server>;
    start(portOrListenOptions: number | ListenOptions, serverOptions?: ServerOptions): Promise<Server>;
    start(portOrListenOptions: number | ListenOptions, httpsServerOptions?: HTTPSServerOptions): Promise<HTTPSServer>;
    stop(): Promise<void>;
}
export declare function verifySignatureAndParseRawBody(logger: Logger, signingSecret: string | (() => PromiseLike<string>)): RequestHandler;
/**
 * This request handler has two responsibilities:
 * - Verify the request signature
 * - Parse `request.body` and assign the successfully parsed object to it.
 */
export declare function verifySignatureAndParseBody(signingSecret: string, body: string, headers: Record<string, any>): AnyMiddlewareArgs['body'];
export declare function buildBodyParserMiddleware(logger: Logger): RequestHandler;
export {};
//# sourceMappingURL=ExpressReceiver.d.ts.map