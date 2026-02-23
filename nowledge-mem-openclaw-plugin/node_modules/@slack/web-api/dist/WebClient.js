"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebClient = exports.WebClientEvent = void 0;
exports.buildThreadTsWarningMessage = buildThreadTsWarningMessage;
const node_path_1 = require("node:path");
const node_querystring_1 = require("node:querystring");
const node_util_1 = require("node:util");
const node_zlib_1 = __importDefault(require("node:zlib"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const is_electron_1 = __importDefault(require("is-electron"));
const is_stream_1 = __importDefault(require("is-stream"));
const p_queue_1 = __importDefault(require("p-queue"));
const p_retry_1 = __importStar(require("p-retry"));
const chat_stream_1 = require("./chat-stream");
const errors_1 = require("./errors");
const file_upload_1 = require("./file-upload");
const helpers_1 = __importDefault(require("./helpers"));
const instrument_1 = require("./instrument");
const logger_1 = require("./logger");
const methods_1 = require("./methods");
const retry_policies_1 = require("./retry-policies");
/*
 * Helpers
 */
// Props on axios default headers object to ignore when retrieving full list of actual headers sent in any HTTP requests
const axiosHeaderPropsToIgnore = [
    'delete',
    'common',
    'get',
    'put',
    'head',
    'post',
    'link',
    'patch',
    'purge',
    'unlink',
    'options',
];
const defaultFilename = 'Untitled';
const defaultPageSize = 200;
const noopPageReducer = () => undefined;
var WebClientEvent;
(function (WebClientEvent) {
    // TODO: safe to rename this to conform to PascalCase enum type naming convention?
    WebClientEvent["RATE_LIMITED"] = "rate_limited";
})(WebClientEvent || (exports.WebClientEvent = WebClientEvent = {}));
/**
 * A client for Slack's Web API
 *
 * This client provides an alias for each {@link https://docs.slack.dev/reference/methods|Web API method}. Each method is
 * a convenience wrapper for calling the {@link WebClient#apiCall} method using the method name as the first parameter.
 */
class WebClient extends methods_1.Methods {
    /**
     * @param token - An API token to authenticate/authorize with Slack (usually start with `xoxp`, `xoxb`)
     * @param {Object} [webClientOptions] - Configuration options.
     * @param {Function} [webClientOptions.requestInterceptor] - An interceptor to mutate outgoing requests. See {@link https://axios-http.com/docs/interceptors Axios interceptors}
     * @param {Function} [webClientOptions.adapter] - An adapter to allow custom handling of requests. Useful if you would like to use a pre-configured http client. See {@link https://github.com/axios/axios/blob/v1.x/README.md?plain=1#L586 Axios adapter}
     */
    constructor(token, { slackApiUrl = 'https://slack.com/api/', logger = undefined, logLevel = undefined, maxRequestConcurrency = 100, retryConfig = retry_policies_1.tenRetriesInAboutThirtyMinutes, agent = undefined, tls = undefined, timeout = 0, rejectRateLimitedCalls = false, headers = {}, teamId = undefined, allowAbsoluteUrls = true, attachOriginalToWebAPIRequestError = true, requestInterceptor = undefined, adapter = undefined, } = {}) {
        super();
        this.token = token;
        this.slackApiUrl = slackApiUrl;
        if (!this.slackApiUrl.endsWith('/')) {
            this.slackApiUrl += '/';
        }
        this.retryConfig = retryConfig;
        this.requestQueue = new p_queue_1.default({ concurrency: maxRequestConcurrency });
        // NOTE: may want to filter the keys to only those acceptable for TLS options
        this.tlsConfig = tls !== undefined ? tls : {};
        this.rejectRateLimitedCalls = rejectRateLimitedCalls;
        this.teamId = teamId;
        this.allowAbsoluteUrls = allowAbsoluteUrls;
        this.attachOriginalToWebAPIRequestError = attachOriginalToWebAPIRequestError;
        // Logging
        if (typeof logger !== 'undefined') {
            this.logger = logger;
            if (typeof logLevel !== 'undefined') {
                this.logger.debug('The logLevel given to WebClient was ignored as you also gave logger');
            }
        }
        else {
            this.logger = (0, logger_1.getLogger)(WebClient.loggerName, logLevel !== null && logLevel !== void 0 ? logLevel : logger_1.LogLevel.INFO, logger);
        }
        if (this.token && !headers.Authorization)
            headers.Authorization = `Bearer ${this.token}`;
        this.axios = axios_1.default.create({
            adapter: adapter ? (config) => adapter(Object.assign(Object.assign({}, config), { adapter: undefined })) : undefined,
            timeout,
            baseURL: this.slackApiUrl,
            headers: (0, is_electron_1.default)() ? headers : Object.assign({ 'User-Agent': (0, instrument_1.getUserAgent)() }, headers),
            httpAgent: agent,
            httpsAgent: agent,
            validateStatus: () => true, // all HTTP status codes should result in a resolved promise (as opposed to only 2xx)
            maxRedirects: 0,
            // disabling axios' automatic proxy support:
            // axios would read from envvars to configure a proxy automatically, but it doesn't support TLS destinations.
            // for compatibility with https://api.slack.com, and for a larger set of possible proxies (SOCKS or other
            // protocols), users of this package should use the `agent` option to configure a proxy.
            proxy: false,
        });
        // serializeApiCallData will always determine the appropriate content-type
        this.axios.defaults.headers.post['Content-Type'] = undefined;
        // request interceptors have reversed execution order
        // see: https://github.com/axios/axios/blob/v1.x/test/specs/interceptors.spec.js#L88
        if (requestInterceptor) {
            this.axios.interceptors.request.use(requestInterceptor, null);
        }
        this.axios.interceptors.request.use(this.serializeApiCallData.bind(this), null);
        this.logger.debug('initialized');
    }
    /**
     * Generic method for calling a Web API method
     * @param method - the Web API method to call {@link https://docs.slack.dev/reference/methods}
     * @param options - options
     */
    apiCall(method_1) {
        return __awaiter(this, arguments, void 0, function* (method, options = {}) {
            this.logger.debug(`apiCall('${method}') start`);
            warnDeprecations(method, this.logger);
            warnIfFallbackIsMissing(method, this.logger, options);
            warnIfThreadTsIsNotString(method, this.logger, options);
            if (typeof options === 'string' || typeof options === 'number' || typeof options === 'boolean') {
                throw new TypeError(`Expected an options argument but instead received a ${typeof options}`);
            }
            (0, file_upload_1.warnIfNotUsingFilesUploadV2)(method, this.logger);
            // @ts-expect-error insufficient overlap between Record and FilesUploadV2Arguments
            if (method === 'files.uploadV2')
                return this.filesUploadV2(options);
            const headers = {};
            if (options.token)
                headers.Authorization = `Bearer ${options.token}`;
            const url = this.deriveRequestUrl(method);
            const response = yield this.makeRequest(url, Object.assign({ team_id: this.teamId }, options), headers);
            const result = yield this.buildResult(response);
            this.logger.debug(`http request result: ${JSON.stringify(result)}`);
            // log warnings in response metadata
            if (result.response_metadata !== undefined && result.response_metadata.warnings !== undefined) {
                result.response_metadata.warnings.forEach(this.logger.warn.bind(this.logger));
            }
            // log warnings and errors in response metadata messages
            // related to https://docs.slack.dev/changelog/2016/09/28/response-metadata-is-on-the-way
            if (result.response_metadata !== undefined && result.response_metadata.messages !== undefined) {
                for (const msg of result.response_metadata.messages) {
                    const errReg = /\[ERROR\](.*)/;
                    const warnReg = /\[WARN\](.*)/;
                    if (errReg.test(msg)) {
                        const errMatch = msg.match(errReg);
                        if (errMatch != null) {
                            this.logger.error(errMatch[1].trim());
                        }
                    }
                    else if (warnReg.test(msg)) {
                        const warnMatch = msg.match(warnReg);
                        if (warnMatch != null) {
                            this.logger.warn(warnMatch[1].trim());
                        }
                    }
                }
            }
            // If result's content is gzip, "ok" property is not returned with successful response
            // TODO: look into simplifying this code block to only check for the second condition
            // if an { ok: false } body applies for all API errors
            if (!result.ok && response.headers['content-type'] !== 'application/gzip') {
                throw (0, errors_1.platformErrorFromResult)(result);
            }
            if ('ok' in result && result.ok === false) {
                throw (0, errors_1.platformErrorFromResult)(result);
            }
            this.logger.debug(`apiCall('${method}') end`);
            return result;
        });
    }
    paginate(method, options, shouldStop, reduce) {
        const pageSize = (() => {
            if (options !== undefined && typeof options.limit === 'number') {
                const { limit } = options;
                options.limit = undefined;
                return limit;
            }
            return defaultPageSize;
        })();
        function generatePages() {
            return __asyncGenerator(this, arguments, function* generatePages_1() {
                // when result is undefined, that signals that the first of potentially many calls has not yet been made
                let result;
                // paginationOptions stores pagination options not already stored in the options argument
                let paginationOptions = {
                    limit: pageSize,
                };
                if (options !== undefined && options.cursor !== undefined) {
                    paginationOptions.cursor = options.cursor;
                }
                // NOTE: test for the situation where you're resuming a pagination using and existing cursor
                while (result === undefined || paginationOptions !== undefined) {
                    result = yield __await(this.apiCall(method, Object.assign(options !== undefined ? options : {}, paginationOptions)));
                    yield yield __await(result);
                    paginationOptions = paginationOptionsForNextPage(result, pageSize);
                }
            });
        }
        if (shouldStop === undefined) {
            return generatePages.call(this);
        }
        const pageReducer = reduce !== undefined ? reduce : noopPageReducer;
        let index = 0;
        return (() => __awaiter(this, void 0, void 0, function* () {
            // Unroll the first iteration of the iterator
            // This is done primarily because in order to satisfy the type system, we need a variable that is typed as A
            // (shown as accumulator before), but before the first iteration all we have is a variable typed A | undefined.
            // Unrolling the first iteration allows us to deal with undefined as a special case.
            var _a, e_1, _b, _c;
            const pageIterator = generatePages.call(this);
            const firstIteratorResult = yield pageIterator.next(undefined);
            // Assumption: there will always be at least one result in a paginated API request
            // if (firstIteratorResult.done) { return; }
            const firstPage = firstIteratorResult.value;
            let accumulator = pageReducer(undefined, firstPage, index);
            index += 1;
            if (shouldStop(firstPage)) {
                return accumulator;
            }
            try {
                // Continue iteration
                for (var _d = true, pageIterator_1 = __asyncValues(pageIterator), pageIterator_1_1; pageIterator_1_1 = yield pageIterator_1.next(), _a = pageIterator_1_1.done, !_a; _d = true) {
                    _c = pageIterator_1_1.value;
                    _d = false;
                    const page = _c;
                    accumulator = pageReducer(accumulator, page, index);
                    if (shouldStop(page)) {
                        return accumulator;
                    }
                    index += 1;
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (!_d && !_a && (_b = pageIterator_1.return)) yield _b.call(pageIterator_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return accumulator;
        }))();
    }
    /**
     * Stream markdown text into a conversation.
     *
     * @description The "chatStream" method starts a new chat stream in a conversation that can be appended to. After appending an entire message, the stream can be stopped with concluding arguments such as "blocks" for gathering feedback.
     *
     * The "markdown_text" content is appended to a buffer before being sent to the recipient, with a default buffer size of "256" characters. Setting the "buffer_size" value to a smaller number sends more frequent updates for the same amount of characters, but might reach rate limits more often.
     *
     * @example
     * const streamer = client.chatStream({
     *   channel: "C0123456789",
     *   thread_ts: "1700000001.123456",
     *   recipient_team_id: "T0123456789",
     *   recipient_user_id: "U0123456789",
     * });
     * await streamer.append({
     *   markdown_text: "**hello wo",
     * });
     * await streamer.append({
     *   markdown_text: "rld!**",
     * });
     * await streamer.stop();
     *
     * @see {@link https://docs.slack.dev/reference/methods/chat.startStream}
     * @see {@link https://docs.slack.dev/reference/methods/chat.appendStream}
     * @see {@link https://docs.slack.dev/reference/methods/chat.stopStream}
     */
    chatStream(params) {
        const { buffer_size } = params, args = __rest(params, ["buffer_size"]);
        const options = {
            buffer_size,
        };
        return new chat_stream_1.ChatStreamer(this, this.logger, args, options);
    }
    /**
     * This wrapper method provides an easy way to upload files using the following endpoints:
     *
     * **#1**: For each file submitted with this method, submit filenames
     * and file metadata to {@link https://docs.slack.dev/reference/methods/files.getuploadurlexternal files.getUploadURLExternal} to request a URL to
     * which to send the file data to and an id for the file
     *
     * **#2**: for each returned file `upload_url`, upload corresponding file to
     * URLs returned from step 1 (e.g. https://files.slack.com/upload/v1/...\")
     *
     * **#3**: Complete uploads {@link https://docs.slack.dev/reference/methods/files.completeuploadexternal files.completeUploadExternal}
     * @param options
     */
    filesUploadV2(options) {
        return __awaiter(this, void 0, void 0, function* () {
            this.logger.debug('files.uploadV2() start');
            // 1
            const fileUploads = yield this.getAllFileUploads(options);
            const fileUploadsURLRes = yield this.fetchAllUploadURLExternal(fileUploads);
            // set the upload_url and file_id returned from Slack
            fileUploadsURLRes.forEach((res, idx) => {
                fileUploads[idx].upload_url = res.upload_url;
                fileUploads[idx].file_id = res.file_id;
            });
            // 2
            yield this.postFileUploadsToExternalURL(fileUploads, options);
            // 3
            const completion = yield this.completeFileUploads(fileUploads);
            return { ok: true, files: completion };
        });
    }
    /**
     * For each file submitted with this method, submits filenames
     * and file metadata to files.getUploadURLExternal to request a URL to
     * which to send the file data to and an id for the file
     * @param fileUploads
     */
    fetchAllUploadURLExternal(fileUploads) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.all(fileUploads.map((upload) => {
                const options = {
                    filename: upload.filename,
                    length: upload.length,
                    alt_text: upload.alt_text,
                    snippet_type: upload.snippet_type,
                };
                if ('token' in upload) {
                    options.token = upload.token;
                }
                return this.files.getUploadURLExternal(options);
            }));
        });
    }
    /**
     * Complete uploads.
     * @param fileUploads
     * @returns
     */
    completeFileUploads(fileUploads) {
        return __awaiter(this, void 0, void 0, function* () {
            const toComplete = Object.values((0, file_upload_1.getAllFileUploadsToComplete)(fileUploads));
            return Promise.all(toComplete.map((job) => this.files.completeUploadExternal(job)));
        });
    }
    /**
     * for each returned file upload URL, upload corresponding file
     * @param fileUploads
     * @returns
     */
    postFileUploadsToExternalURL(fileUploads, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return Promise.all(fileUploads.map((upload) => __awaiter(this, void 0, void 0, function* () {
                const { upload_url, file_id, filename, data } = upload;
                // either file or content will be defined
                const body = data;
                // try to post to external url
                if (upload_url) {
                    const headers = {};
                    if (options.token)
                        headers.Authorization = `Bearer ${options.token}`;
                    const uploadRes = yield this.makeRequest(upload_url, {
                        body,
                    }, headers);
                    if (uploadRes.status !== 200) {
                        return Promise.reject(Error(`Failed to upload file (id:${file_id}, filename: ${filename})`));
                    }
                    const returnData = { ok: true, body: uploadRes.data };
                    return Promise.resolve(returnData);
                }
                return Promise.reject(Error(`No upload url found for file (id: ${file_id}, filename: ${filename}`));
            })));
        });
    }
    /**
     * @param options All file uploads arguments
     * @returns An array of file upload entries
     */
    getAllFileUploads(options) {
        return __awaiter(this, void 0, void 0, function* () {
            let fileUploads = [];
            // add single file data to uploads if file or content exists at the top level
            if ('file' in options || 'content' in options) {
                fileUploads.push(yield (0, file_upload_1.getFileUploadJob)(options, this.logger));
            }
            // add multiple files data when file_uploads is supplied
            if ('file_uploads' in options) {
                fileUploads = fileUploads.concat(yield (0, file_upload_1.getMultipleFileUploadJobs)(options, this.logger));
            }
            return fileUploads;
        });
    }
    /**
     * Low-level function to make a single API request. handles queuing, retries, and http-level errors
     */
    makeRequest(url_1, body_1) {
        return __awaiter(this, arguments, void 0, function* (url, body, headers = {}) {
            // TODO: better input types - remove any
            const task = () => this.requestQueue.add(() => __awaiter(this, void 0, void 0, function* () {
                try {
                    // biome-ignore lint/suspicious/noExplicitAny: TODO: type this
                    const config = Object.assign({ headers }, this.tlsConfig);
                    // admin.analytics.getFile returns a binary response
                    // To be able to parse it, it should be read as an ArrayBuffer
                    if (url.endsWith('admin.analytics.getFile')) {
                        config.responseType = 'arraybuffer';
                    }
                    // apps.event.authorizations.list will reject HTTP requests that send token in the body
                    // TODO: consider applying this change to all methods - though that will require thorough integration testing
                    if (url.endsWith('apps.event.authorizations.list')) {
                        body.token = undefined;
                    }
                    this.logger.debug(`http request url: ${url}`);
                    this.logger.debug(`http request body: ${JSON.stringify(redact(body))}`);
                    // compile all headers - some set by default under the hood by axios - that will be sent along
                    let allHeaders = Object.keys(this.axios.defaults.headers).reduce((acc, cur) => {
                        if (!axiosHeaderPropsToIgnore.includes(cur)) {
                            acc[cur] = this.axios.defaults.headers[cur];
                        }
                        return acc;
                    }, {});
                    allHeaders = Object.assign(Object.assign(Object.assign({}, this.axios.defaults.headers.common), allHeaders), headers);
                    this.logger.debug(`http request headers: ${JSON.stringify(redact(allHeaders))}`);
                    const response = yield this.axios.post(url, body, config);
                    this.logger.debug('http response received');
                    if (response.status === 429) {
                        const retrySec = parseRetryHeaders(response);
                        if (retrySec !== undefined) {
                            this.emit(WebClientEvent.RATE_LIMITED, retrySec, { url, body });
                            if (this.rejectRateLimitedCalls) {
                                throw new p_retry_1.AbortError((0, errors_1.rateLimitedErrorWithDelay)(retrySec));
                            }
                            this.logger.info(`API Call failed due to rate limiting. Will retry in ${retrySec} seconds.`);
                            // pause the request queue and then delay the rejection by the amount of time in the retry header
                            this.requestQueue.pause();
                            // NOTE: if there was a way to introspect the current RetryOperation and know what the next timeout
                            // would be, then we could subtract that time from the following delay, knowing that it the next
                            // attempt still wouldn't occur until after the rate-limit header has specified. an even better
                            // solution would be to subtract the time from only the timeout of this next attempt of the
                            // RetryOperation. this would result in the staying paused for the entire duration specified in the
                            // header, yet this operation not having to pay the timeout cost in addition to that.
                            yield (0, helpers_1.default)(retrySec * 1000);
                            // resume the request queue and throw a non-abort error to signal a retry
                            this.requestQueue.start();
                            // TODO: We may want to have more detailed info such as team_id, params except tokens, and so on.
                            throw new Error(`A rate limit was exceeded (url: ${url}, retry-after: ${retrySec})`);
                        }
                        // TODO: turn this into some CodedError
                        throw new p_retry_1.AbortError(new Error(`Retry header did not contain a valid timeout (url: ${url}, retry-after header: ${response.headers['retry-after']})`));
                    }
                    // Slack's Web API doesn't use meaningful status codes besides 429 and 200
                    if (response.status !== 200) {
                        throw (0, errors_1.httpErrorFromResponse)(response);
                    }
                    return response;
                }
                catch (error) {
                    // To make this compatible with tsd, casting here instead of `catch (error: any)`
                    // biome-ignore lint/suspicious/noExplicitAny: errors can be anything
                    const e = error;
                    this.logger.warn('http request failed', e.message);
                    if (e.request) {
                        throw (0, errors_1.requestErrorWithOriginal)(e, this.attachOriginalToWebAPIRequestError);
                    }
                    throw error;
                }
            }));
            // biome-ignore lint/suspicious/noExplicitAny: http responses can be anything
            return (0, p_retry_1.default)(task, this.retryConfig);
        });
    }
    /**
     * Get the complete request URL for the provided URL.
     * @param url - The resource to POST to. Either a Slack API method or absolute URL.
     */
    deriveRequestUrl(url) {
        const isAbsoluteURL = url.startsWith('https://') || url.startsWith('http://');
        if (isAbsoluteURL && this.allowAbsoluteUrls) {
            return url;
        }
        return `${this.axios.getUri() + url}`;
    }
    /**
     * Transforms options (a simple key-value object) into an acceptable value for a body. This can be either
     * a string, used when posting with a content-type of url-encoded. Or, it can be a readable stream, used
     * when the options contain a binary (a stream or a buffer) and the upload should be done with content-type
     * multipart/form-data.
     * @param config - The Axios request configuration object
     */
    serializeApiCallData(config) {
        const { data, headers } = config;
        // The following operation both flattens complex objects into a JSON-encoded strings and searches the values for
        // binary content
        let containsBinaryData = false;
        // biome-ignore lint/suspicious/noExplicitAny: HTTP request data can be anything
        const flattened = Object.entries(data).map(([key, value]) => {
            if (value === undefined || value === null) {
                return [];
            }
            let serializedValue = value;
            if (Buffer.isBuffer(value) || (0, is_stream_1.default)(value)) {
                containsBinaryData = true;
            }
            else if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
                // if value is anything other than string, number, boolean, binary data, a Stream, or a Buffer, then encode it
                // as a JSON string.
                serializedValue = JSON.stringify(value);
            }
            return [key, serializedValue];
        });
        // A body with binary content should be serialized as multipart/form-data
        if (containsBinaryData) {
            this.logger.debug('Request arguments contain binary data');
            const form = flattened.reduce((frm, [key, value]) => {
                if (Buffer.isBuffer(value) || (0, is_stream_1.default)(value)) {
                    const opts = {};
                    opts.filename = (() => {
                        // attempt to find filename from `value`. adapted from:
                        // https://github.com/form-data/form-data/blob/028c21e0f93c5fefa46a7bbf1ba753e4f627ab7a/lib/form_data.js#L227-L230
                        // formidable and the browser add a name property
                        // fs- and request- streams have path property
                        // biome-ignore lint/suspicious/noExplicitAny: form values can be anything
                        const streamOrBuffer = value;
                        if (typeof streamOrBuffer.name === 'string') {
                            return (0, node_path_1.basename)(streamOrBuffer.name);
                        }
                        if (typeof streamOrBuffer.path === 'string') {
                            return (0, node_path_1.basename)(streamOrBuffer.path);
                        }
                        return defaultFilename;
                    })();
                    frm.append(key, value, opts);
                }
                else if (key !== undefined && value !== undefined) {
                    frm.append(key, value);
                }
                return frm;
            }, new form_data_1.default());
            if (headers) {
                // Copying FormData-generated headers into headers param
                // not reassigning to headers param since it is passed by reference and behaves as an inout param
                for (const [header, value] of Object.entries(form.getHeaders())) {
                    headers[header] = value;
                }
            }
            config.data = form;
            config.headers = headers;
            return config;
        }
        // Otherwise, a simple key-value object is returned
        if (headers)
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
        // biome-ignore lint/suspicious/noExplicitAny: form values can be anything
        const initialValue = {};
        config.data = (0, node_querystring_1.stringify)(flattened.reduce((accumulator, [key, value]) => {
            if (key !== undefined && value !== undefined) {
                accumulator[key] = value;
            }
            return accumulator;
        }, initialValue));
        config.headers = headers;
        return config;
    }
    /**
     * Processes an HTTP response into a WebAPICallResult by performing JSON parsing on the body and merging relevant
     * HTTP headers into the object.
     * @param response - an http response
     */
    buildResult(response) {
        return __awaiter(this, void 0, void 0, function* () {
            let { data } = response;
            const isGzipResponse = response.headers['content-type'] === 'application/gzip';
            // Check for GZIP response - if so, it is a successful response from admin.analytics.getFile
            if (isGzipResponse) {
                // admin.analytics.getFile will return a Buffer that can be unzipped
                try {
                    const unzippedData = yield new Promise((resolve, reject) => {
                        node_zlib_1.default.unzip(data, (err, buf) => {
                            if (err) {
                                return reject(err);
                            }
                            return resolve(buf.toString().split('\n'));
                        });
                    })
                        .then((res) => res)
                        .catch((err) => {
                        throw err;
                    });
                    const fileData = [];
                    if (Array.isArray(unzippedData)) {
                        for (const dataset of unzippedData) {
                            if (dataset && dataset.length > 0) {
                                fileData.push(JSON.parse(dataset));
                            }
                        }
                    }
                    data = { file_data: fileData };
                }
                catch (err) {
                    data = { ok: false, error: err };
                }
            }
            else if (!isGzipResponse && response.request.path === '/api/admin.analytics.getFile') {
                // if it isn't a Gzip response but is from the admin.analytics.getFile request,
                // decode the ArrayBuffer to JSON read the error
                data = JSON.parse(new node_util_1.TextDecoder().decode(data));
            }
            if (typeof data === 'string') {
                // response.data can be a string, not an object for some reason
                try {
                    data = JSON.parse(data);
                }
                catch (_) {
                    // failed to parse the string value as JSON data
                    data = { ok: false, error: data };
                }
            }
            if (data.response_metadata === undefined) {
                data.response_metadata = {};
            }
            // add scopes metadata from headers
            if (response.headers['x-oauth-scopes'] !== undefined) {
                data.response_metadata.scopes = response.headers['x-oauth-scopes'].trim().split(/\s*,\s*/);
            }
            if (response.headers['x-accepted-oauth-scopes'] !== undefined) {
                data.response_metadata.acceptedScopes = response.headers['x-accepted-oauth-scopes']
                    .trim()
                    .split(/\s*,\s*/);
            }
            // add retry metadata from headers
            const retrySec = parseRetryHeaders(response);
            if (retrySec !== undefined) {
                data.response_metadata.retryAfter = retrySec;
            }
            return data;
        });
    }
}
exports.WebClient = WebClient;
/**
 * The name used to prefix all logging generated from this object
 */
WebClient.loggerName = 'WebClient';
exports.default = WebClient;
/**
 * Determines an appropriate set of cursor pagination options for the next request to a paginated API method.
 * @param previousResult - the result of the last request, where the next cursor might be found.
 * @param pageSize - the maximum number of additional items to fetch in the next request.
 */
function paginationOptionsForNextPage(previousResult, pageSize) {
    if (previousResult !== undefined &&
        previousResult.response_metadata !== undefined &&
        previousResult.response_metadata.next_cursor !== undefined &&
        previousResult.response_metadata.next_cursor !== '') {
        return {
            limit: pageSize,
            cursor: previousResult.response_metadata.next_cursor,
        };
    }
    return undefined;
}
/**
 * Extract the amount of time (in seconds) the platform has recommended this client wait before sending another request
 * from a rate-limited HTTP response (statusCode = 429).
 */
function parseRetryHeaders(response) {
    if (response.headers['retry-after'] !== undefined) {
        const retryAfter = Number.parseInt(response.headers['retry-after'], 10);
        if (!Number.isNaN(retryAfter)) {
            return retryAfter;
        }
    }
    return undefined;
}
/**
 * Log a warning when using a deprecated method
 * @param method api method being called
 * @param logger instance of web clients logger
 */
function warnDeprecations(method, logger) {
    const deprecatedMethods = ['workflows.stepCompleted', 'workflows.stepFailed', 'workflows.updateStep'];
    const isDeprecated = deprecatedMethods.some((depMethod) => {
        const re = new RegExp(`^${depMethod}`);
        return re.test(method);
    });
    if (isDeprecated) {
        logger.warn(`${method} is deprecated. Please check on https://docs.slack.dev/reference/methods for an alternative.`);
    }
}
/**
 * Log a warning when using chat.postMessage without text argument or attachments with fallback argument
 * @param method api method being called
 * @param logger instance of we clients logger
 * @param options arguments for the Web API method
 */
function warnIfFallbackIsMissing(method, logger, options) {
    const targetMethods = ['chat.postEphemeral', 'chat.postMessage', 'chat.scheduleMessage'];
    const isTargetMethod = targetMethods.includes(method);
    const hasAttachments = (args) => Array.isArray(args.attachments) && args.attachments.length;
    const missingAttachmentFallbackDetected = (args) => Array.isArray(args.attachments) &&
        args.attachments.some((attachment) => !attachment.fallback || attachment.fallback.trim() === '');
    const isEmptyText = (args) => (args.text === undefined || args.text === null || args.text === '') &&
        (args.markdown_text === undefined || args.markdown === null || args.markdown_text === '');
    const buildMissingTextWarning = () => `The top-level \`text\` argument is missing in the request payload for a ${method} call - It's a best practice to always provide a \`text\` argument when posting a message. The \`text\` is used in places where the content cannot be rendered such as: system push notifications, assistive technology such as screen readers, etc.`;
    const buildMissingFallbackWarning = () => `Additionally, the attachment-level \`fallback\` argument is missing in the request payload for a ${method} call - To avoid this warning, it is recommended to always provide a top-level \`text\` argument when posting a message. Alternatively, you can provide an attachment-level \`fallback\` argument, though this is now considered a legacy field (see https://docs.slack.dev/legacy/legacy-messaging/legacy-secondary-message-attachments for more details).`;
    if (isTargetMethod && typeof options === 'object') {
        if (hasAttachments(options)) {
            if (missingAttachmentFallbackDetected(options) && isEmptyText(options)) {
                logger.warn(buildMissingTextWarning());
                logger.warn(buildMissingFallbackWarning());
            }
        }
        else if (isEmptyText(options)) {
            logger.warn(buildMissingTextWarning());
        }
    }
}
/**
 * Log a warning when thread_ts is not a string
 * @param method api method being called
 * @param logger instance of web clients logger
 * @param options arguments for the Web API method
 */
function warnIfThreadTsIsNotString(method, logger, options) {
    const targetMethods = ['chat.postEphemeral', 'chat.postMessage', 'chat.scheduleMessage', 'files.upload'];
    const isTargetMethod = targetMethods.includes(method);
    if (isTargetMethod && (options === null || options === void 0 ? void 0 : options.thread_ts) !== undefined && typeof (options === null || options === void 0 ? void 0 : options.thread_ts) !== 'string') {
        logger.warn(buildThreadTsWarningMessage(method));
    }
}
function buildThreadTsWarningMessage(method) {
    return `The given thread_ts value in the request payload for a ${method} call is a float value. We highly recommend using a string value instead.`;
}
/**
 * Takes an object and redacts specific items
 * @param body
 * @returns
 */
function redact(body) {
    // biome-ignore lint/suspicious/noExplicitAny: objects can be anything
    const flattened = Object.entries(body).map(([key, value]) => {
        // no value provided
        if (value === undefined || value === null) {
            return [];
        }
        let serializedValue = value;
        // redact possible tokens
        if (key.match(/.*token.*/) !== null || key.match(/[Aa]uthorization/)) {
            serializedValue = '[[REDACTED]]';
        }
        // when value is buffer or stream we can avoid logging it
        if (Buffer.isBuffer(value) || (0, is_stream_1.default)(value)) {
            serializedValue = '[[BINARY VALUE OMITTED]]';
        }
        else if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
            serializedValue = JSON.stringify(value);
        }
        return [key, serializedValue];
    });
    // return as object
    const initialValue = {};
    return flattened.reduce((accumulator, [key, value]) => {
        if (key !== undefined && value !== undefined) {
            accumulator[key] = value;
        }
        return accumulator;
    }, initialValue);
}
//# sourceMappingURL=WebClient.js.map