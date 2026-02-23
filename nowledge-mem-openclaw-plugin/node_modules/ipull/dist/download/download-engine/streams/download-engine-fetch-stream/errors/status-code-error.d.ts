import HttpError from "./http-error.js";
export default class StatusCodeError extends HttpError {
    readonly url: string;
    readonly statusCode: number;
    readonly statusText: string;
    headers?: {
        [key: string]: string | string[];
    } | undefined;
    responseHeaders?: {
        [key: string]: string;
    } | undefined;
    constructor(url: string, statusCode: number, statusText: string, headers?: {
        [key: string]: string | string[];
    } | undefined, responseHeaders?: {
        [key: string]: string;
    } | undefined);
    get retryAfter(): number | undefined;
}
