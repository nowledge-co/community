import type { AnyMiddlewareArgs, ReceiverEvent } from './types';
/**
 * Internal data type for capturing the class of event processed in App#onIncomingEvent()
 */
export declare enum IncomingEventType {
    Event = 0,
    Action = 1,
    Command = 2,
    Options = 3,
    ViewAction = 4,// TODO: terminology: ViewAction? Why Action?
    Shortcut = 5
}
/**
 * Helper which finds the type and channel (if any) that any specific incoming event is related to.
 *
 * This is analogous to WhenEventHasChannelContext and the conditional type that checks SlackAction for a channel
 * context.
 */
export declare function getTypeAndConversation(body: any): {
    type?: IncomingEventType;
    conversationId?: string;
};
/**
 * Helper which determines if the body of a request is enterprise install.
 *
 * Providing the type is optional but if you do the execution will be faster
 */
export declare function isBodyWithTypeEnterpriseInstall(body: AnyMiddlewareArgs['body'], type?: IncomingEventType): boolean;
/**
 * Helper which determines if the event type will skip Authorize.
 *
 * Token revocation use cases
 * https://github.com/slackapi/bolt-js/issues/674
 */
export declare function isEventTypeToSkipAuthorize(event: ReceiverEvent): boolean;
/** Helper that should never be called, but is useful for exhaustiveness checking in conditional branches */
export declare function assertNever(x?: never): never;
//# sourceMappingURL=helpers.d.ts.map