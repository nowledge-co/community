import type { ActionConstraints, OptionsConstraints, ShortcutConstraints, ViewConstraints } from '../App';
import type { AnyMiddlewareArgs, EventTypePattern, Middleware, SlackActionMiddlewareArgs, SlackCommandMiddlewareArgs, SlackEventMiddlewareArgs, SlackEventMiddlewareArgsOptions, SlackOptionsMiddlewareArgs, SlackViewMiddlewareArgs } from '../types';
export declare function isSlackEventMiddlewareArgsOptions<EventType extends string = string>(optionOrListener: SlackEventMiddlewareArgsOptions | Middleware<SlackEventMiddlewareArgs<EventType>>): optionOrListener is SlackEventMiddlewareArgsOptions;
/**
 * Middleware that filters out any event that isn't an action
 */
export declare const onlyActions: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that filters out any event that isn't a shortcut
 */
export declare const onlyShortcuts: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that filters out any event that isn't a command
 */
export declare const onlyCommands: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that filters out any event that isn't an options
 */
export declare const onlyOptions: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that filters out any event that isn't an event
 */
export declare const onlyEvents: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that filters out any event that isn't a view_submission or view_closed event
 */
export declare const onlyViewActions: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that auto acknowledges the request received
 */
export declare const autoAcknowledge: Middleware<AnyMiddlewareArgs>;
/**
 * Middleware that checks for matches given constraints
 */
export declare function matchConstraints(constraints: ActionConstraints | ViewConstraints | ShortcutConstraints | OptionsConstraints): Middleware<SlackActionMiddlewareArgs | SlackOptionsMiddlewareArgs | SlackViewMiddlewareArgs>;
export declare function matchMessage(pattern: string | RegExp): Middleware<SlackEventMiddlewareArgs<'message' | 'app_mention'>>;
/**
 * Middleware that filters out any command that doesn't match the pattern
 */
export declare function matchCommandName(pattern: string | RegExp): Middleware<SlackCommandMiddlewareArgs>;
export declare function matchEventType(pattern: EventTypePattern): Middleware<SlackEventMiddlewareArgs>;
/**
 * Filters out any event originating from the handling app.
 */
export declare const ignoreSelf: Middleware<AnyMiddlewareArgs>;
/**
 * Filters out any message events whose subtype does not match the provided subtype.
 */
export declare function subtype(subtype1: string): Middleware<SlackEventMiddlewareArgs<'message'>>;
/**
 * Filters out any message event whose text does not start with an @-mention of the handling app.
 */
export declare const directMention: Middleware<SlackEventMiddlewareArgs<'message'>>;
//# sourceMappingURL=builtin.d.ts.map