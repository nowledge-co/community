import { type ApiError, type ResponseParameters } from "../types.js";
/**
 * This class represents errors that are thrown by grammY because the Telegram
 * Bot API responded with an error.
 *
 * Instances of this class hold the information that the Telegram backend
 * returned.
 *
 * If this error is thrown, grammY could successfully communicate with the
 * Telegram Bot API servers, however, an error code was returned for the
 * respective method call.
 */
export declare class GrammyError extends Error implements ApiError {
    /** The called method name which caused this error to be thrown. */
    readonly method: string;
    /** The payload that was passed when calling the method. */
    readonly payload: Record<string, unknown>;
    /** Flag that this request was unsuccessful. Always `false`. */
    readonly ok: false;
    /** An integer holding Telegram's error code. Subject to change. */
    readonly error_code: number;
    /** A human-readable description of the error. */
    readonly description: string;
    /** Further parameters that may help to automatically handle the error. */
    readonly parameters: ResponseParameters;
    constructor(message: string, err: ApiError, 
    /** The called method name which caused this error to be thrown. */
    method: string, 
    /** The payload that was passed when calling the method. */
    payload: Record<string, unknown>);
}
export declare function toGrammyError(err: ApiError, method: string, payload: Record<string, unknown>): GrammyError;
/**
 * This class represents errors that are thrown by grammY because an HTTP call
 * to the Telegram Bot API failed.
 *
 * Instances of this class hold the error object that was created because the
 * fetch call failed. It can be inspected to determine why exactly the network
 * request failed.
 *
 * If an [API transformer
 * function](https://grammy.dev/advanced/transformers) throws an error,
 * grammY will regard this as if the network request failed. The contained error
 * will then be the error that was thrown by the transformer function.
 */
export declare class HttpError extends Error {
    /** The thrown error object. */
    readonly error: unknown;
    constructor(message: string, 
    /** The thrown error object. */
    error: unknown);
}
export declare function toHttpError(method: string, sensitiveLogs: boolean): (err: unknown) => never;
