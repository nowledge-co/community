/**
 * The options used to initialize the RequestClient
 */
export type RequestClientOptions = {
    /**
     * The header used to send the token in the request.
     * This should generally always be "Bot" unless you are working with OAuth.
     *
     * @default "Bot"
     */
    tokenHeader?: "Bot" | "Bearer";
    /**
     * The base URL of the API.
     * @default https://discord.com/api
     */
    baseUrl?: string;
    /**
     * The version of the API to use.
     * @default 10
     */
    apiVersion?: number;
    /**
     * The user agent to use when making requests.
     * @default DiscordBot (https://github.com/buape/carbon, v0.0.0)
     */
    userAgent?: string;
    /**
     * The timeout for requests.
     * @default 15000
     */
    timeout?: number;
    /**
     * Whether or not to queue requests if you are rate limited.
     * If this is true, requests will be queued and wait for the ratelimit to clear.
     * If this is false, requests will be made immediately and will throw a RateLimitError if you are rate limited.
     *
     * @default true
     */
    queueRequests?: boolean;
    /**
     * The maximum amount of queued requests before throwing.
     * @default 1000
     */
    maxQueueSize?: number;
};
export type QueuedRequest = {
    method: string;
    path: string;
    data?: RequestData;
    query?: Record<string, string | number | boolean>;
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
    routeKey: string;
};
export type RequestData = {
    body?: unknown;
    rawBody?: boolean;
    headers?: Record<string, string>;
};
/**
 * This is the main class that handles making requests to the Discord API.
 * It is used internally by Carbon, and you should not need to use it directly, but feel free to if you feel like living dangerously.
 */
export declare class RequestClient {
    /**
     * The options used to initialize the client
     */
    readonly options: RequestClientOptions;
    protected queue: QueuedRequest[];
    private token;
    private abortController;
    private processingQueue;
    private routeBuckets;
    private bucketStates;
    private globalRateLimitUntil;
    constructor(token: string, options?: RequestClientOptions);
    get(path: string, query?: QueuedRequest["query"]): Promise<unknown>;
    post(path: string, data?: RequestData, query?: QueuedRequest["query"]): Promise<unknown>;
    patch(path: string, data?: RequestData, query?: QueuedRequest["query"]): Promise<unknown>;
    put(path: string, data?: RequestData, query?: QueuedRequest["query"]): Promise<unknown>;
    delete(path: string, data?: RequestData, query?: QueuedRequest["query"]): Promise<unknown>;
    private request;
    private executeRequest;
    private processQueue;
    private waitForBucket;
    private scheduleRateLimit;
    private updateBucketFromHeaders;
    private getBucketKey;
    private getMajorParameter;
    private getRouteKey;
    clearQueue(): void;
    get queueSize(): number;
    abortAllRequests(): void;
}
//# sourceMappingURL=RequestClient.d.ts.map