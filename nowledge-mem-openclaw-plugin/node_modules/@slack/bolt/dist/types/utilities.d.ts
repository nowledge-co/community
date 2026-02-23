import type { ChatPostMessageArguments, ChatPostMessageResponse } from '@slack/web-api';
/**
 * Extend this interface to build a type that is treated as an open set of properties, where each key is a string.
 */
export type StringIndexed = Record<string, any>;
/**
 * Type function which allows either types `T` or `U`, but not both.
 */
export type XOR<T, U> = T | U extends Record<string, unknown> ? (Without<T, U> & U) | (Without<U, T> & T) : T | U;
type Without<T, U> = {
    [P in Exclude<keyof T, keyof U>]?: never;
};
/** Type predicate for use with `Promise.allSettled` for filtering for resolved results. */
export declare const isFulfilled: <T>(p: PromiseSettledResult<T>) => p is PromiseFulfilledResult<T>;
/** Type predicate for use with `Promise.allSettled` for filtering for rejected results. */
export declare const isRejected: <T>(p: PromiseSettledResult<T>) => p is PromiseRejectedResult;
/** Using type parameter T (generic), can distribute the Omit over a union set. */
type DistributiveOmit<T, K extends PropertyKey> = T extends any ? Omit<T, K> : never;
export type SayArguments = DistributiveOmit<ChatPostMessageArguments, 'channel'> & {
    channel?: string;
};
export type SayFn = (message: string | SayArguments) => Promise<ChatPostMessageResponse>;
export type RespondArguments = DistributiveOmit<ChatPostMessageArguments, 'channel' | 'text'> & {
    /** Response URLs can be used to send ephemeral messages or in-channel messages using this argument */
    response_type?: 'in_channel' | 'ephemeral';
    replace_original?: boolean;
    delete_original?: boolean;
    text?: string;
};
export type RespondFn = (message: string | RespondArguments) => Promise<any>;
export type AckFn<Response> = (response?: Response) => Promise<void>;
export {};
//# sourceMappingURL=utilities.d.ts.map