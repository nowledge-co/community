/// <reference types="node" />
/// <reference types="node" />
import type { Agent } from 'node:http';
import type { SecureContextOptions } from 'node:tls';
import { LogLevel, type Logger } from '@slack/logger';
import { WebClient, type WebClientOptions } from '@slack/web-api';
import type { Assistant } from './Assistant';
import { type SlackCustomFunctionMiddlewareArgs } from './CustomFunction';
import type { WorkflowStep } from './WorkflowStep';
import { type ConversationStore } from './conversation-store';
import { type CodedError } from './errors';
import HTTPReceiver, { type HTTPReceiverOptions } from './receivers/HTTPReceiver';
import SocketModeReceiver from './receivers/SocketModeReceiver';
import type { ActionConstraints, AnyMiddlewareArgs, Context, Middleware, OptionsConstraints, OptionsSource, Receiver, ReceiverEvent, ShortcutConstraints, SlackAction, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs, SlackEventMiddlewareArgs, SlackEventMiddlewareArgsOptions, SlackOptionsMiddlewareArgs, SlackShortcut, SlackShortcutMiddlewareArgs, SlackViewAction, SlackViewMiddlewareArgs, ViewConstraints } from './types';
import { type StringIndexed } from './types/utilities';
export type { ActionConstraints, OptionsConstraints, ShortcutConstraints, ViewConstraints } from './types';
/** App initialization options */
export interface AppOptions {
    signingSecret?: HTTPReceiverOptions['signingSecret'];
    endpoints?: HTTPReceiverOptions['endpoints'];
    port?: HTTPReceiverOptions['port'];
    customRoutes?: HTTPReceiverOptions['customRoutes'];
    processBeforeResponse?: HTTPReceiverOptions['processBeforeResponse'];
    signatureVerification?: HTTPReceiverOptions['signatureVerification'];
    clientId?: HTTPReceiverOptions['clientId'];
    clientSecret?: HTTPReceiverOptions['clientSecret'];
    stateSecret?: HTTPReceiverOptions['stateSecret'];
    redirectUri?: HTTPReceiverOptions['redirectUri'];
    installationStore?: HTTPReceiverOptions['installationStore'];
    scopes?: HTTPReceiverOptions['scopes'];
    installerOptions?: HTTPReceiverOptions['installerOptions'];
    agent?: Agent;
    clientTls?: Pick<SecureContextOptions, 'pfx' | 'key' | 'passphrase' | 'cert' | 'ca'>;
    convoStore?: ConversationStore | false;
    token?: AuthorizeResult['botToken'];
    appToken?: string;
    botId?: AuthorizeResult['botId'];
    botUserId?: AuthorizeResult['botUserId'];
    authorize?: Authorize<boolean>;
    receiver?: Receiver;
    logger?: Logger;
    logLevel?: LogLevel;
    ignoreSelf?: boolean;
    /**
     * Configurations for the web client used to send Slack API method requests.
     *
     * See {@link https://tools.slack.dev/node-slack-sdk/reference/web-api/interfaces/WebClientOptions} for more information.
     */
    clientOptions?: WebClientOptions;
    socketMode?: boolean;
    developerMode?: boolean;
    tokenVerificationEnabled?: boolean;
    deferInitialization?: boolean;
    extendedErrorHandler?: boolean;
    attachFunctionToken?: boolean;
}
export { LogLevel, Logger } from '@slack/logger';
/** Authorization function - seeds the middleware processing and listeners with an authorization context */
export type Authorize<IsEnterpriseInstall extends boolean = false> = (source: AuthorizeSourceData<IsEnterpriseInstall>, body?: AnyMiddlewareArgs['body']) => Promise<AuthorizeResult>;
/** Authorization function inputs - authenticated data about an event for the authorization function */
export interface AuthorizeSourceData<IsEnterpriseInstall extends boolean = false> {
    teamId: IsEnterpriseInstall extends true ? string | undefined : string;
    enterpriseId: IsEnterpriseInstall extends true ? string : string | undefined;
    userId?: string;
    conversationId?: string;
    isEnterpriseInstall: IsEnterpriseInstall;
}
/** Authorization function outputs - data that will be available as part of event processing */
export interface AuthorizeResult {
    botToken?: string;
    userToken?: string;
    botId?: string;
    botUserId?: string;
    userId?: string;
    teamId?: string;
    enterpriseId?: string;
    [key: string]: any;
}
interface AllErrorHandlerArgs {
    error: Error;
    logger: Logger;
    body: AnyMiddlewareArgs['body'];
    context: Context;
}
export interface ExtendedErrorHandlerArgs extends AllErrorHandlerArgs {
    error: CodedError;
}
export type ErrorHandler = (error: CodedError) => Promise<void>;
export type ExtendedErrorHandler = (args: ExtendedErrorHandlerArgs) => Promise<void>;
export interface AnyErrorHandler extends ErrorHandler, ExtendedErrorHandler {
}
type MessageEventMiddleware<CustomContext extends StringIndexed = StringIndexed> = Middleware<SlackEventMiddlewareArgs<'message'>, CustomContext>;
/**
 * A Slack App
 */
export default class App<AppCustomContext extends StringIndexed = StringIndexed> {
    /** Slack Web API client */
    client: WebClient;
    private clientOptions;
    private clients;
    /** Receiver - ingests events from the Slack platform */
    private receiver;
    /** Logger */
    logger: Logger;
    /** Log Level */
    private logLevel;
    /** Authorize */
    private authorize;
    /** Global middleware chain */
    private middleware;
    /** Listener middleware chains */
    private listeners;
    private errorHandler;
    private axios;
    private installerOptions;
    private socketMode;
    private developerMode;
    private extendedErrorHandler;
    private hasCustomErrorHandler;
    private argToken?;
    private argAuthorize?;
    private argAuthorization?;
    private tokenVerificationEnabled;
    private initialized;
    private attachFunctionToken;
    constructor({ signingSecret, endpoints, port, customRoutes, agent, clientTls, receiver, convoStore, token, appToken, botId, botUserId, authorize, logger, logLevel, ignoreSelf, clientOptions, processBeforeResponse, signatureVerification, clientId, clientSecret, stateSecret, redirectUri, installationStore, scopes, installerOptions, socketMode, developerMode, tokenVerificationEnabled, extendedErrorHandler, deferInitialization, attachFunctionToken, }?: AppOptions);
    init(): Promise<void>;
    get webClientOptions(): WebClientOptions;
    /**
     * Register a new middleware, processed in the order registered.
     *
     * @param m global middleware function
     */
    use<MiddlewareCustomContext extends StringIndexed = StringIndexed>(m: Middleware<AnyMiddlewareArgs, AppCustomContext & MiddlewareCustomContext>): this;
    /**
     * Register Assistant middleware
     *
     * @param assistant global assistant middleware function
     */
    assistant(assistant: Assistant): this;
    /**
     * Register WorkflowStep middleware
     *
     * @param workflowStep global workflow step middleware function
     * @deprecated Steps from Apps are no longer supported and support for them will be removed in the next major bolt-js
     * version.
     */
    step(workflowStep: WorkflowStep): this;
    /**
     * Register middleware for a workflow step.
     * @param callbackId Unique callback ID of a step.
     * @param [options] Configurations for the listener.
     * @param listeners Middleware handlers to call.
     * @see {@link https://tools.slack.dev/bolt-js/concepts/custom-steps}
     * @see {@link https://docs.slack.dev/workflows/creating-custom-steps-dynamic-options}
     */
    function(callbackId: string, options: SlackEventMiddlewareArgsOptions, ...listeners: Middleware<SlackCustomFunctionMiddlewareArgs>[]): this;
    function(callbackId: string, ...listeners: Middleware<SlackCustomFunctionMiddlewareArgs>[]): this;
    /**
     * Convenience method to call start on the receiver
     *
     * TODO: should replace HTTPReceiver in type definition with a generic that is constrained to Receiver
     *
     * @param args receiver-specific start arguments
     */
    start(...args: Parameters<HTTPReceiver['start'] | SocketModeReceiver['start']>): ReturnType<HTTPReceiver['start']>;
    stop(...args: any[]): Promise<unknown>;
    event<EventType extends string = string, MiddlewareCustomContext extends StringIndexed = StringIndexed>(eventName: EventType, ...listeners: Middleware<SlackEventMiddlewareArgs<EventType>, AppCustomContext & MiddlewareCustomContext>[]): void;
    event<EventType extends RegExp = RegExp, MiddlewareCustomContext extends StringIndexed = StringIndexed>(eventName: EventType, ...listeners: Middleware<SlackEventMiddlewareArgs<string>, AppCustomContext & MiddlewareCustomContext>[]): void;
    /**
     *
     * @param listeners Middlewares that process and react to a message event
     */
    message<MiddlewareCustomContext extends StringIndexed = StringIndexed>(...listeners: MessageEventMiddleware<AppCustomContext & MiddlewareCustomContext>[]): void;
    /**
     *
     * @param pattern Used for filtering out messages that don't match.
     * Strings match via {@link String.prototype.includes}.
     * @param listeners Middlewares that process and react to the message events that matched the provided patterns.
     */
    message<MiddlewareCustomContext extends StringIndexed = StringIndexed>(pattern: string | RegExp, ...listeners: MessageEventMiddleware<AppCustomContext & MiddlewareCustomContext>[]): void;
    /**
     *
     * @param filter Middleware that can filter out messages. Generally this is done by returning before
     * calling {@link AllMiddlewareArgs.next} if there is no match. See {@link directMention} for an example.
     * @param pattern Used for filtering out messages that don't match the pattern. Strings match
     * via {@link String.prototype.includes}.
     * @param listeners Middlewares that process and react to the message events that matched the provided pattern.
     */
    message<MiddlewareCustomContext extends StringIndexed = StringIndexed>(filter: MessageEventMiddleware<AppCustomContext & MiddlewareCustomContext>, pattern: string | RegExp, ...listeners: MessageEventMiddleware<AppCustomContext & MiddlewareCustomContext>[]): void;
    /**
     *
     * @param filter Middleware that can filter out messages. Generally this is done by returning before calling
     * {@link AllMiddlewareArgs.next} if there is no match. See {@link directMention} for an example.
     * @param listeners Middlewares that process and react to the message events that matched the provided patterns.
     */
    message<MiddlewareCustomContext extends StringIndexed = StringIndexed>(filter: MessageEventMiddleware, // TODO: why do we need this override? shouldnt ...listeners capture this too?
    ...listeners: MessageEventMiddleware<AppCustomContext & MiddlewareCustomContext>[]): void;
    /**
     * This allows for further control of the filtering and response logic. Patterns and middlewares are processed in
     * the order provided. If any patterns do not match, or a middleware does not call {@link AllMiddlewareArgs.next},
     * all remaining patterns and middlewares will be skipped.
     * @param patternsOrMiddleware A mix of patterns and/or middlewares.
     */
    message<MiddlewareCustomContext extends StringIndexed = StringIndexed>(...patternsOrMiddleware: (string | RegExp | MessageEventMiddleware<AppCustomContext & MiddlewareCustomContext>)[]): void;
    shortcut<Shortcut extends SlackShortcut = SlackShortcut, MiddlewareCustomContext extends StringIndexed = StringIndexed>(callbackId: string | RegExp, ...listeners: Middleware<SlackShortcutMiddlewareArgs<Shortcut>, AppCustomContext & MiddlewareCustomContext>[]): void;
    shortcut<Shortcut extends SlackShortcut = SlackShortcut, Constraints extends ShortcutConstraints<Shortcut> = ShortcutConstraints<Shortcut>, MiddlewareCustomContext extends StringIndexed = StringIndexed>(constraints: Constraints, ...listeners: Middleware<SlackShortcutMiddlewareArgs<Extract<Shortcut, {
        type: Constraints['type'];
    }>>, AppCustomContext & MiddlewareCustomContext>[]): void;
    action<Action extends SlackAction = SlackAction, MiddlewareCustomContext extends StringIndexed = StringIndexed>(actionId: string | RegExp, ...listeners: Middleware<SlackActionMiddlewareArgs<Action>, AppCustomContext & MiddlewareCustomContext>[]): void;
    action<Action extends SlackAction = SlackAction, Constraints extends ActionConstraints<Action> = ActionConstraints<Action>, MiddlewareCustomContext extends StringIndexed = StringIndexed>(constraints: Constraints, ...listeners: Middleware<SlackActionMiddlewareArgs<Extract<Action, {
        type: Constraints['type'];
    }>>, AppCustomContext & MiddlewareCustomContext>[]): void;
    command<MiddlewareCustomContext extends StringIndexed = StringIndexed>(commandName: string | RegExp, ...listeners: Middleware<SlackCommandMiddlewareArgs, AppCustomContext & MiddlewareCustomContext>[]): void;
    options<Source extends OptionsSource = 'block_suggestion', // TODO: here, similarly to `message()`, the generic is the string `type` of the payload. in others, like `action()`, it's the entire payload. could we make this consistent?
    MiddlewareCustomContext extends StringIndexed = StringIndexed>(actionId: string | RegExp, ...listeners: Middleware<SlackOptionsMiddlewareArgs<Source>, AppCustomContext & MiddlewareCustomContext>[]): void;
    options<Source extends OptionsSource = OptionsSource, MiddlewareCustomContext extends StringIndexed = StringIndexed>(constraints: OptionsConstraints, // TODO: to be able to 'link' listener arguments to the constrains, should pass the Source type in as a generic here
    ...listeners: Middleware<SlackOptionsMiddlewareArgs<Source>, AppCustomContext & MiddlewareCustomContext>[]): void;
    view<ViewActionType extends SlackViewAction = SlackViewAction, MiddlewareCustomContext extends StringIndexed = StringIndexed>(callbackId: string | RegExp, ...listeners: Middleware<SlackViewMiddlewareArgs<ViewActionType>, AppCustomContext & MiddlewareCustomContext>[]): void;
    view<ViewActionType extends SlackViewAction = SlackViewAction, MiddlewareCustomContext extends StringIndexed = StringIndexed>(constraints: ViewConstraints, ...listeners: Middleware<SlackViewMiddlewareArgs<ViewActionType>, AppCustomContext & MiddlewareCustomContext>[]): void;
    error(errorHandler: ErrorHandler): void;
    error(errorHandler: ExtendedErrorHandler): void;
    /**
     * Handles events from the receiver
     */
    processEvent(event: ReceiverEvent): Promise<void>;
    /**
     * Global error handler. The final destination for all errors (hopefully).
     */
    private handleError;
    private initReceiver;
    private initAuthorizeIfNoTokenIsGiven;
    private initAuthorizeInConstructor;
}
//# sourceMappingURL=App.d.ts.map