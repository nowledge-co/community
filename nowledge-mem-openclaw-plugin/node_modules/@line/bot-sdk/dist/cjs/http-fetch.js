"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertResponseToReadable = convertResponseToReadable;
exports.normalizeHeaders = normalizeHeaders;
exports.mergeHeaders = mergeHeaders;
const node_buffer_1 = require("node:buffer");
const node_stream_1 = require("node:stream");
const exceptions_js_1 = require("./exceptions.js");
const version_js_1 = require("./version.js");
function convertResponseToReadable(response) {
    const reader = response.body.getReader();
    return new node_stream_1.Readable({
        async read() {
            const { done, value } = await reader.read();
            if (done) {
                this.push(null);
            }
            else {
                this.push(node_buffer_1.Buffer.from(value));
            }
        },
    });
}
function normalizeHeaders(headers) {
    const normalized = {};
    if (!headers) {
        return normalized;
    }
    for (const key of Object.keys(headers)) {
        normalized[key.toLowerCase()] = headers[key];
    }
    return normalized;
}
function mergeHeaders(base, override) {
    const normalizedBase = normalizeHeaders(base);
    const normalizedOverride = normalizeHeaders(override);
    return Object.assign(Object.assign({}, normalizedBase), normalizedOverride);
}
class HTTPFetchClient {
    constructor(config) {
        this.baseURL = config.baseURL;
        this.defaultHeaders = mergeHeaders({ "User-Agent": version_js_1.USER_AGENT }, config.defaultHeaders);
    }
    async get(url, params) {
        const requestUrl = new URL(url, this.baseURL);
        if (params) {
            const searchParams = new URLSearchParams();
            for (const key in params) {
                if (params.hasOwnProperty(key)) {
                    searchParams.append(key, params[key]);
                }
            }
            requestUrl.search = searchParams.toString();
        }
        const response = await fetch(requestUrl, {
            headers: this.defaultHeaders,
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async post(url, body, config) {
        const requestUrl = new URL(url, this.baseURL);
        const response = await fetch(requestUrl, {
            method: "POST",
            headers: Object.assign(Object.assign({ "Content-Type": "application/json" }, this.defaultHeaders), (config && config.headers)),
            body: JSON.stringify(body),
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async put(url, body, config) {
        const requestUrl = new URL(url, this.baseURL);
        const response = await fetch(requestUrl, {
            method: "PUT",
            headers: Object.assign(Object.assign({ "Content-Type": "application/json" }, this.defaultHeaders), (config && config.headers)),
            body: JSON.stringify(body),
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async postForm(url, body) {
        const requestUrl = new URL(url, this.baseURL);
        const params = new URLSearchParams();
        for (const key in body) {
            if (body.hasOwnProperty(key)) {
                params.append(key, body[key]);
            }
        }
        const response = await fetch(requestUrl, {
            method: "POST",
            headers: Object.assign({ "Content-Type": "application/x-www-form-urlencoded" }, this.defaultHeaders),
            body: params.toString(),
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async postFormMultipart(url, form) {
        const requestUrl = new URL(url, this.baseURL);
        const response = await fetch(requestUrl, {
            method: "POST",
            headers: Object.assign({}, this.defaultHeaders),
            body: form,
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async putFormMultipart(url, form, config) {
        const requestUrl = new URL(url, this.baseURL);
        const response = await fetch(requestUrl, {
            method: "PUT",
            headers: Object.assign(Object.assign({}, this.defaultHeaders), (config && (config.headers ? config.headers : {}))),
            body: form,
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async postBinaryContent(url, body) {
        const requestUrl = new URL(url, this.baseURL);
        const response = await fetch(requestUrl, {
            method: "POST",
            headers: Object.assign({ "Content-Type": body.type }, this.defaultHeaders),
            body: body,
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async delete(url, params) {
        const requestUrl = new URL(url, this.baseURL);
        if (params) {
            requestUrl.search = new URLSearchParams(params).toString();
        }
        const response = await fetch(requestUrl, {
            method: "DELETE",
            headers: Object.assign({}, this.defaultHeaders),
        });
        await this.checkResponseStatus(response);
        return response;
    }
    async checkResponseStatus(response) {
        const { ok, status, statusText, headers } = response;
        const message = `${status} - ${statusText}`;
        if (!ok) {
            const body = await response.text();
            throw new exceptions_js_1.HTTPFetchError(message, {
                status,
                statusText,
                headers,
                body,
            });
        }
    }
}
exports.default = HTTPFetchClient;
//# sourceMappingURL=http-fetch.js.map