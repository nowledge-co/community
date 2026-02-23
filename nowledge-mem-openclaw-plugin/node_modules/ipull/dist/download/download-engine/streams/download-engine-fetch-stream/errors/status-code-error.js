import HttpError from "./http-error.js";
export default class StatusCodeError extends HttpError {
    url;
    statusCode;
    statusText;
    headers;
    responseHeaders;
    constructor(url, statusCode, statusText, headers, responseHeaders) {
        super();
        this.url = url;
        this.statusCode = statusCode;
        this.statusText = statusText;
        this.headers = headers;
        this.responseHeaders = responseHeaders;
        this.message = `Url: ${url}, Status code: ${statusCode}, status text: ${statusText}`;
    }
    get retryAfter() {
        const retryAfter = this.responseHeaders?.["retry-after"];
        if (retryAfter) {
            const number = parseInt(retryAfter, 10);
            if (isNaN(number)) {
                return new Date(retryAfter).getTime() - Date.now();
            }
            return number;
        }
        else if (this.responseHeaders?.["ratelimit-reset"]) {
            return parseInt(this.responseHeaders["ratelimit-reset"], 10) * 1000;
        }
        return;
    }
}
//# sourceMappingURL=status-code-error.js.map