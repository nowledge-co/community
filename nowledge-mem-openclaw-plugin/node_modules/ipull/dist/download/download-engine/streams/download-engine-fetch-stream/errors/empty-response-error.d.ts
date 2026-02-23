import FetchStreamError from "./fetch-stream-error.js";
export default class EmptyResponseError extends FetchStreamError {
    readonly headers: {
        [key: string]: string | string[];
    };
    constructor(url: string, headers: {
        [key: string]: string | string[];
    });
}
