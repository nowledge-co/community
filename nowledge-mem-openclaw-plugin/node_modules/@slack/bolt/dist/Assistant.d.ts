import type { AssistantThreadsSetStatusArguments, AssistantThreadsSetStatusResponse, AssistantThreadsSetSuggestedPromptsResponse, AssistantThreadsSetTitleResponse } from '@slack/web-api';
import { type AssistantThreadContext, type AssistantThreadContextStore } from './AssistantThreadContextStore';
import type { AllMiddlewareArgs, AnyMiddlewareArgs, Middleware, SayFn, SlackEventMiddlewareArgs } from './types';
/**
 * Configuration object used to instantiate the Assistant
 */
export interface AssistantConfig {
    threadContextStore?: AssistantThreadContextStore;
    threadStarted: AssistantThreadStartedMiddleware | AssistantThreadStartedMiddleware[];
    threadContextChanged?: AssistantThreadContextChangedMiddleware | AssistantThreadContextChangedMiddleware[];
    userMessage: AssistantUserMessageMiddleware | AssistantUserMessageMiddleware[];
}
/**
 * Callback utilities
 */
interface AssistantUtilityArgs {
    getThreadContext: GetThreadContextUtilFn;
    saveThreadContext: SaveThreadContextUtilFn;
    say: SayFn;
    setStatus: SetStatusFn;
    setSuggestedPrompts: SetSuggestedPromptsFn;
    setTitle: SetTitleFn;
}
type GetThreadContextUtilFn = () => Promise<AssistantThreadContext>;
type SaveThreadContextUtilFn = () => Promise<void>;
type SetStatusFn = (status: string | Omit<AssistantThreadsSetStatusArguments, 'channel_id' | 'thread_ts'>) => Promise<AssistantThreadsSetStatusResponse>;
type SetSuggestedPromptsFn = (params: SetSuggestedPromptsArguments) => Promise<AssistantThreadsSetSuggestedPromptsResponse>;
interface SetSuggestedPromptsArguments {
    /** @description Prompt suggestions that appear when opening assistant thread. */
    prompts: AssistantPrompt[];
    /** @description Title for the prompts. */
    title?: string;
}
interface AssistantPrompt {
    /** @description Title of the prompt. */
    title: string;
    /** @description Message of the prompt. */
    message: string;
}
type SetTitleFn = (title: string) => Promise<AssistantThreadsSetTitleResponse>;
/**
 * Middleware
 */
export type AssistantThreadStartedMiddleware = Middleware<AssistantThreadStartedMiddlewareArgs>;
export type AssistantThreadContextChangedMiddleware = Middleware<AssistantThreadContextChangedMiddlewareArgs>;
export type AssistantUserMessageMiddleware = Middleware<AssistantUserMessageMiddlewareArgs>;
export type AssistantMiddleware = AssistantThreadStartedMiddleware[] | AssistantThreadContextChangedMiddleware[] | AssistantUserMessageMiddleware[];
export type AssistantMiddlewareArgs = AssistantThreadStartedMiddlewareArgs | AssistantThreadContextChangedMiddlewareArgs | AssistantUserMessageMiddlewareArgs;
export interface AssistantThreadStartedMiddlewareArgs extends Omit<SlackEventMiddlewareArgs<'assistant_thread_started'>, 'say'>, AssistantUtilityArgs {
}
export interface AssistantThreadContextChangedMiddlewareArgs extends Omit<SlackEventMiddlewareArgs<'assistant_thread_context_changed'>, 'say'>, AssistantUtilityArgs {
}
export interface AssistantUserMessageMiddlewareArgs extends Omit<SlackEventMiddlewareArgs<'message'>, 'say'>, AssistantUtilityArgs {
}
export type AllAssistantMiddlewareArgs<T extends AssistantMiddlewareArgs = AssistantMiddlewareArgs> = T & AllMiddlewareArgs;
export declare class Assistant {
    private threadContextStore;
    /** 'assistant_thread_started' */
    private threadStarted;
    /** 'assistant_thread_context_changed' */
    private threadContextChanged;
    /** 'message' */
    private userMessage;
    constructor(config: AssistantConfig);
    getMiddleware(): Middleware<AnyMiddlewareArgs>;
    private processEvent;
    /**
     * `getAssistantMiddleware()` returns the Assistant instance's middleware
     */
    private getAssistantMiddleware;
}
/**
 * `enrichAssistantArgs()` takes the event arguments and:
 *  1. Removes the next() passed in from App-level middleware processing, thus preventing
 *  events from continuing down the global middleware chain to subsequent listeners
 *  2. Adds assistant-specific utilities (i.e., helper methods)
 * */
export declare function enrichAssistantArgs(threadContextStore: AssistantThreadContextStore, args: AllAssistantMiddlewareArgs<AssistantMiddlewareArgs>): AllAssistantMiddlewareArgs;
/**
 * `isAssistantEvent()` determines if incoming event is a supported
 * Assistant event type.
 */
export declare function isAssistantEvent(args: AnyMiddlewareArgs): args is AllAssistantMiddlewareArgs;
/**
 * `matchesConstraints()` determines if the incoming event payload
 * is related to the Assistant.
 */
export declare function matchesConstraints(args: AssistantMiddlewareArgs): args is AssistantMiddlewareArgs;
/**
 * `isAssistantMessage()` evaluates if the message payload is associated
 * with the Assistant container.
 */
export declare function isAssistantMessage(payload: AnyMiddlewareArgs['payload']): boolean;
/**
 * `validate()` determines if the provided AssistantConfig is a valid configuration.
 */
export declare function validate(config: AssistantConfig): void;
/**
 * `processAssistantMiddleware()` invokes each callback for the given event
 */
export declare function processAssistantMiddleware(args: AllAssistantMiddlewareArgs, middleware: AssistantMiddleware): Promise<void>;
/**
 * `extractThreadInfo()` parses an incoming payload and returns relevant
 * details about the thread
 */
export declare function extractThreadInfo(payload: AllAssistantMiddlewareArgs['payload']): {
    channelId: string;
    threadTs: string;
    context: AssistantThreadContext;
};
export {};
//# sourceMappingURL=Assistant.d.ts.map