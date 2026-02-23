import type { Agent } from 'node:http';
import type { SecureContextOptions } from 'node:tls';
import { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { ChatStreamer, type ChatStreamerOptions } from './chat-stream';
import { type Logger, LogLevel } from './logger';
import { Methods } from './methods';
import { type RetryOptions } from './retry-policies';
import type { ChatStartStreamArguments } from './types/request';
import type { FilesUploadV2Arguments } from './types/request/files';
import type { FilesCompleteUploadExternalResponse } from './types/response';
export interface WebClientOptions {
    /**
     * The base URL requests are sent to. Often unchanged, but might be set for testing techniques.
     *
     * See {@link https://docs.slack.dev/tools/node-slack-sdk/web-api/#custom-api-url} for more information.
     * @default https://slack.com/api/
     */
    slackApiUrl?: string;
    logger?: Logger;
    logLevel?: LogLevel;
    maxRequestConcurrency?: number;
    retryConfig?: RetryOptions;
    agent?: Agent;
    tls?: TLSOptions;
    timeout?: number;
    rejectRateLimitedCalls?: boolean;
    headers?: Record<string, string>;
    teamId?: string;
    /**
     * Determines if a dynamic method name being an absolute URL overrides the configured slackApiUrl.
     * When set to false, the URL used in Slack API requests will always begin with the slackApiUrl.
     *
     * See {@link https://docs.slack.dev/tools/node-slack-sdk/web-api/#call-a-method} for more details.
     * See {@link https://github.com/axios/axios?tab=readme-ov-file#request-config} for more details.
     * @default true
     */
    allowAbsoluteUrls?: boolean;
    /**
     * Indicates whether to attach the original error to a Web API request error.
     * When set to true, the original error object will be attached to the Web API request error.
     * @type {boolean}
     * @default true
     */
    attachOriginalToWebAPIRequestError?: boolean;
    /**
     * Custom function to modify outgoing requests. See {@link https://axios-http.com/docs/interceptors Axios interceptor documentation} for more details.
     * @type {Function | undefined}
     * @default undefined
     */
    requestInterceptor?: RequestInterceptor;
    /**
     * Custom functions for modifing and handling outgoing requests.
     * Useful if you would like to manage outgoing request with a custom http client.
     * See {@link https://github.com/axios/axios/blob/v1.x/README.md?plain=1#L586 Axios adapter documentation} for more information.
     * @type {Function | undefined}
     * @default undefined
     */
    adapter?: AdapterConfig;
}
export type TLSOptions = Pick<SecureContextOptions, 'pfx' | 'key' | 'passphrase' | 'cert' | 'ca'>;
export declare enum WebClientEvent {
    RATE_LIMITED = "rate_limited"
}
export interface WebAPICallResult {
    ok: boolean;
    error?: string;
    response_metadata?: {
        warnings?: string[];
        next_cursor?: string;
        scopes?: string[];
        acceptedScopes?: string[];
        retryAfter?: number;
        messages?: string[];
    };
}
export type PaginatePredicate = (page: WebAPICallResult) => boolean | undefined | undefined;
export type PageReducer<A = any> = (accumulator: A | undefined, page: WebAPICallResult, index: number) => A;
export type PageAccumulator<R extends PageReducer> = R extends (accumulator: infer A | undefined, page: WebAPICallResult, index: number) => infer A ? A : never;
/**
 * An alias to {@link https://github.com/axios/axios/blob/v1.x/index.d.ts#L367 Axios' `InternalAxiosRequestConfig`} object,
 * which is the main parameter type provided to Axios interceptors and adapters.
 */
export type RequestConfig = InternalAxiosRequestConfig;
/**
 * An alias to {@link https://github.com/axios/axios/blob/v1.x/index.d.ts#L489 Axios' `AxiosInterceptorManager<InternalAxiosRequestConfig>` onFufilled} method,
 * which controls the custom request interceptor logic
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
/**
 * An alias to {@link https://github.com/axios/axios/blob/v1.x/index.d.ts#L112 Axios' `AxiosAdapter`} interface,
 * which is the contract required to specify an adapter
 */
export type AdapterConfig = AxiosAdapter;
/**
 * A client for Slack's Web API
 *
 * This client provides an alias for each {@link https://docs.slack.dev/reference/methods|Web API method}. Each method is
 * a convenience wrapper for calling the {@link WebClient#apiCall} method using the method name as the first parameter.
 */
export declare class WebClient extends Methods {
    /**
     * The base URL for reaching Slack's Web API. Consider changing this value for testing purposes.
     */
    readonly slackApiUrl: string;
    /**
     * Authentication and authorization token for accessing Slack Web API (usually begins with `xoxp` or `xoxb`)
     */
    readonly token?: string;
    /**
     * Configuration for retry operations. See {@link https://github.com/tim-kos/node-retry|node-retry} for more details.
     */
    private retryConfig;
    /**
     * Queue of requests in which a maximum of {@link WebClientOptions.maxRequestConcurrency} can concurrently be
     * in-flight.
     */
    private requestQueue;
    /**
     * Axios HTTP client instance used by this client
     */
    private axios;
    /**
     * Configuration for custom TLS handling
     */
    private tlsConfig;
    /**
     * Preference for immediately rejecting API calls which result in a rate-limited response
     */
    private rejectRateLimitedCalls;
    /**
     * The name used to prefix all logging generated from this object
     */
    private static loggerName;
    /**
     * This object's logger instance
     */
    private logger;
    /**
     * This object's teamId value
     */
    private teamId?;
    /**
     * Determines if a dynamic method name being an absolute URL overrides the configured slackApiUrl.
     * When set to false, the URL used in Slack API requests will always begin with the slackApiUrl.
     *
     * See {@link https://docs.slack.dev/tools/node-slack-sdk/web-api/#call-a-method} for more details.
     * See {@link https://github.com/axios/axios?tab=readme-ov-file#request-config} for more details.
     * @default true
     */
    private allowAbsoluteUrls;
    /**
     * Configuration to opt-out of attaching the original error
     * (obtained from the HTTP client) to WebAPIRequestError.
     */
    private attachOriginalToWebAPIRequestError;
    /**
     * @param token - An API token to authenticate/authorize with Slack (usually start with `xoxp`, `xoxb`)
     * @param {Object} [webClientOptions] - Configuration options.
     * @param {Function} [webClientOptions.requestInterceptor] - An interceptor to mutate outgoing requests. See {@link https://axios-http.com/docs/interceptors Axios interceptors}
     * @param {Function} [webClientOptions.adapter] - An adapter to allow custom handling of requests. Useful if you would like to use a pre-configured http client. See {@link https://github.com/axios/axios/blob/v1.x/README.md?plain=1#L586 Axios adapter}
     */
    constructor(token?: string, { slackApiUrl, logger, logLevel, maxRequestConcurrency, retryConfig, agent, tls, timeout, rejectRateLimitedCalls, headers, teamId, allowAbsoluteUrls, attachOriginalToWebAPIRequestError, requestInterceptor, adapter, }?: WebClientOptions);
    /**
     * Generic method for calling a Web API method
     * @param method - the Web API method to call {@link https://docs.slack.dev/reference/methods}
     * @param options - options
     */
    apiCall(method: string, options?: Record<string, unknown>): Promise<WebAPICallResult>;
    /**
     * Iterate over the result pages of a cursor-paginated Web API method. This method can return two types of values,
     * depending on which arguments are used. When up to two parameters are used, the return value is an async iterator
     * which can be used as the iterable in a for-await-of loop. When three or four parameters are used, the return
     * value is a promise that resolves at the end of iteration. The third parameter, `shouldStop`, is a function that is
     * called with each `page` and can end iteration by returning `true`. The fourth parameter, `reduce`, is a function
     * that is called with three arguments: `accumulator`, `page`, and `index`. The `accumulator` is a value of any type
     * you choose, but it will contain `undefined` when `reduce` is called for the first time. The `page` argument and
     * `index` arguments are exactly what they say they are. The `reduce` function's return value will be passed in as
     * `accumulator` the next time it's called, and the returned promise will resolve to the last value of `accumulator`.
     *
     * The for-await-of syntax is part of ES2018. It is available natively in Node starting with v10.0.0. You may be able
     * to use it in earlier JavaScript runtimes by transpiling your source with a tool like Babel. However, the
     * transpiled code will likely sacrifice performance.
     * @param method - the cursor-paginated Web API method to call {@link https://docs.slack.dev/apis/web-api/paginationn}
     * @param options - options
     * @param shouldStop - a predicate that is called with each page, and should return true when pagination can end.
     * @param reduce - a callback that can be used to accumulate a value that the return promise is resolved to
     */
    paginate(method: string, options?: Record<string, unknown>): AsyncIterable<WebAPICallResult>;
    paginate(method: string, options: Record<string, unknown>, shouldStop: PaginatePredicate): Promise<void>;
    paginate<R extends PageReducer, A extends PageAccumulator<R>>(method: string, options: Record<string, unknown>, shouldStop: PaginatePredicate, reduce?: PageReducer<A>): Promise<A>;
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
    chatStream(params: Omit<ChatStartStreamArguments & ChatStreamerOptions, 'markdown_text'>): ChatStreamer;
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
    filesUploadV2(options: FilesUploadV2Arguments): Promise<WebAPICallResult & {
        files: FilesCompleteUploadExternalResponse[];
    }>;
    /**
     * For each file submitted with this method, submits filenames
     * and file metadata to files.getUploadURLExternal to request a URL to
     * which to send the file data to and an id for the file
     * @param fileUploads
     */
    private fetchAllUploadURLExternal;
    /**
     * Complete uploads.
     * @param fileUploads
     * @returns
     */
    private completeFileUploads;
    /**
     * for each returned file upload URL, upload corresponding file
     * @param fileUploads
     * @returns
     */
    private postFileUploadsToExternalURL;
    /**
     * @param options All file uploads arguments
     * @returns An array of file upload entries
     */
    private getAllFileUploads;
    /**
     * Low-level function to make a single API request. handles queuing, retries, and http-level errors
     */
    private makeRequest;
    /**
     * Get the complete request URL for the provided URL.
     * @param url - The resource to POST to. Either a Slack API method or absolute URL.
     */
    private deriveRequestUrl;
    /**
     * Transforms options (a simple key-value object) into an acceptable value for a body. This can be either
     * a string, used when posting with a content-type of url-encoded. Or, it can be a readable stream, used
     * when the options contain a binary (a stream or a buffer) and the upload should be done with content-type
     * multipart/form-data.
     * @param config - The Axios request configuration object
     */
    private serializeApiCallData;
    /**
     * Processes an HTTP response into a WebAPICallResult by performing JSON parsing on the body and merging relevant
     * HTTP headers into the object.
     * @param response - an http response
     */
    private buildResult;
}
export default WebClient;
export declare function buildThreadTsWarningMessage(method: string): string;
//# sourceMappingURL=WebClient.d.ts.map