import FetchStreamError from "./fetch-stream-error.js";
export default class EmptyResponseError extends FetchStreamError {
    headers;
    constructor(url, headers) {
        super("Empty response error: " + url);
        this.headers = headers;
    }
}
//# sourceMappingURL=empty-response-error.js.map