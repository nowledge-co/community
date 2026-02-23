import { DiscordError } from "../errors/DiscordError.js";
import { RateLimitError } from "../errors/RatelimitError.js";
const defaultOptions = {
    tokenHeader: "Bot",
    baseUrl: "https://discord.com/api",
    apiVersion: 10,
    userAgent: "DiscordBot (https://github.com/buape/carbon, v0.0.0)",
    timeout: 15000,
    queueRequests: true,
    maxQueueSize: 1000
};
/**
 * This is the main class that handles making requests to the Discord API.
 * It is used internally by Carbon, and you should not need to use it directly, but feel free to if you feel like living dangerously.
 */
export class RequestClient {
    /**
     * The options used to initialize the client
     */
    options;
    queue = [];
    token;
    abortController = null;
    processingQueue = false;
    routeBuckets = new Map();
    bucketStates = new Map();
    globalRateLimitUntil = 0;
    constructor(token, options) {
        this.token = token;
        this.options = {
            ...defaultOptions,
            ...options
        };
    }
    async get(path, query) {
        return await this.request("GET", path, { query });
    }
    async post(path, data, query) {
        return await this.request("POST", path, { data, query });
    }
    async patch(path, data, query) {
        return await this.request("PATCH", path, { data, query });
    }
    async put(path, data, query) {
        return await this.request("PUT", path, { data, query });
    }
    async delete(path, data, query) {
        return await this.request("DELETE", path, { data, query });
    }
    async request(method, path, { data, query }) {
        const routeKey = this.getRouteKey(method, path);
        if (this.options.queueRequests) {
            if (typeof this.options.maxQueueSize === "number" &&
                this.options.maxQueueSize > 0 &&
                this.queue.length >= this.options.maxQueueSize) {
                const stats = this.queue.reduce((acc, item) => {
                    const count = (acc.counts.get(item.routeKey) ?? 0) + 1;
                    acc.counts.set(item.routeKey, count);
                    if (count > acc.topCount) {
                        acc.topCount = count;
                        acc.topRoute = item.routeKey;
                    }
                    return acc;
                }, {
                    counts: new Map([[routeKey, 1]]),
                    topRoute: routeKey,
                    topCount: 1
                });
                throw new Error(`Request queue is full (${this.queue.length} / ${this.options.maxQueueSize}), you should implement a queuing system in your requests or raise the queue size in Carbon. Top offender: ${stats.topRoute}`);
            }
            return new Promise((resolve, reject) => {
                this.queue.push({
                    method,
                    path,
                    data,
                    query,
                    resolve,
                    reject,
                    routeKey
                });
                this.processQueue();
            });
        }
        return new Promise((resolve, reject) => {
            this.executeRequest({
                method,
                path,
                data,
                query,
                resolve,
                reject,
                routeKey
            })
                .then(resolve)
                .catch((err) => {
                reject(err);
            });
        });
    }
    async executeRequest(request) {
        const { method, path, data, query, routeKey } = request;
        await this.waitForBucket(routeKey);
        const queryString = query
            ? `?${Object.entries(query)
                .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                .join("&")}`
            : "";
        const url = `${this.options.baseUrl}${path}${queryString}`;
        const headers = this.token === "webhook"
            ? new Headers()
            : new Headers({
                Authorization: `${this.options.tokenHeader} ${this.token}`
            });
        // Add custom headers if provided
        if (data?.headers) {
            for (const [key, value] of Object.entries(data.headers)) {
                headers.set(key, value);
            }
        }
        this.abortController = new AbortController();
        const timeoutMs = typeof this.options.timeout === "number" && this.options.timeout > 0
            ? this.options.timeout
            : undefined;
        let body;
        if (data?.body &&
            typeof data.body === "object" &&
            ("files" in data.body ||
                ("data" in data.body &&
                    data.body.data &&
                    typeof data.body.data === "object" &&
                    "files" in data.body.data))) {
            const payload = data.body;
            if (typeof payload === "string") {
                data.body = { content: payload, attachments: [] };
            }
            else {
                data.body = { ...payload, attachments: [] };
            }
            const formData = new FormData();
            const files = (() => {
                if (typeof payload === "object" && payload !== null) {
                    if ("files" in payload) {
                        return payload.files || [];
                    }
                    if ("data" in payload &&
                        typeof payload.data === "object" &&
                        payload.data !== null) {
                        return (payload.data
                            .files || []);
                    }
                }
                return [];
            })();
            for (const [index, file] of files.entries()) {
                let { data: fileData } = file;
                if (!(fileData instanceof Blob)) {
                    fileData = new Blob([fileData]);
                }
                formData.append(`files[${index}]`, fileData, file.name);
                data.body.attachments.push({
                    id: index,
                    filename: file.name,
                    description: file.description
                });
            }
            if (data.body != null) {
                const cleanedBody = {
                    ...data.body,
                    files: undefined
                };
                formData.append("payload_json", JSON.stringify(cleanedBody));
            }
            body = formData;
        }
        else if (data?.body != null) {
            headers.set("Content-Type", "application/json");
            if (data.rawBody) {
                body = data.body;
            }
            else {
                body = JSON.stringify(data.body);
            }
        }
        let timeoutId;
        if (timeoutMs !== undefined) {
            timeoutId = setTimeout(() => {
                this.abortController?.abort();
            }, timeoutMs);
        }
        let response;
        try {
            response = await fetch(url, {
                method,
                headers,
                body,
                signal: this.abortController.signal
            });
        }
        finally {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
        }
        let rawBody = "";
        let parsedBody;
        try {
            rawBody = await response.text();
        }
        catch {
            rawBody = "";
        }
        if (rawBody.length > 0) {
            try {
                parsedBody = JSON.parse(rawBody);
            }
            catch {
                parsedBody = undefined;
            }
        }
        if (response.status === 429) {
            const rateLimitBody = parsedBody &&
                typeof parsedBody === "object" &&
                "retry_after" in parsedBody &&
                "message" in parsedBody
                ? parsedBody
                : {
                    message: typeof parsedBody === "string"
                        ? parsedBody
                        : rawBody || "You are being rate limited.",
                    retry_after: (() => {
                        const retryAfterHeader = response.headers.get("Retry-After");
                        if (retryAfterHeader &&
                            !Number.isNaN(Number(retryAfterHeader))) {
                            return Number(retryAfterHeader);
                        }
                        return 1;
                    })(),
                    global: response.headers.get("X-RateLimit-Scope") === "global"
                };
            const rateLimitError = new RateLimitError(response, rateLimitBody);
            this.scheduleRateLimit(routeKey, path, rateLimitError);
            throw rateLimitError;
        }
        this.updateBucketFromHeaders(routeKey, path, response);
        if (response.status >= 400 && response.status < 600) {
            const discordErrorBody = parsedBody && typeof parsedBody === "object"
                ? parsedBody
                : {
                    message: rawBody || "Discord API error",
                    code: 0
                };
            throw new DiscordError(response, discordErrorBody);
        }
        if (parsedBody !== undefined)
            return parsedBody;
        if (rawBody.length > 0)
            return rawBody;
        return null;
    }
    async processQueue() {
        if (this.processingQueue)
            return;
        this.processingQueue = true;
        while (this.queue.length > 0) {
            const queueItem = this.queue.shift();
            if (!queueItem)
                continue;
            const { resolve, reject } = queueItem;
            try {
                const result = await this.executeRequest(queueItem);
                resolve(result);
            }
            catch (error) {
                if (error instanceof RateLimitError && this.options.queueRequests) {
                    this.queue.unshift(queueItem);
                }
                else if (error instanceof Error) {
                    reject(error);
                }
                else {
                    reject(new Error("Unknown error during request", { cause: error }));
                }
            }
            finally {
                this.abortController = null;
            }
        }
        this.processingQueue = false;
        if (this.queue.length > 0) {
            this.processQueue();
        }
    }
    async waitForBucket(routeKey) {
        while (true) {
            const now = Date.now();
            if (this.globalRateLimitUntil > now) {
                await sleep(this.globalRateLimitUntil - now);
                continue;
            }
            const bucketKey = this.routeBuckets.get(routeKey) ?? routeKey;
            const bucket = this.bucketStates.get(bucketKey);
            if (bucket && bucket.delayUntil > now) {
                await sleep(bucket.delayUntil - now);
                continue;
            }
            break;
        }
    }
    scheduleRateLimit(routeKey, path, error) {
        const bucketKey = error.bucket
            ? this.getBucketKey(routeKey, path, error.bucket)
            : (this.routeBuckets.get(routeKey) ?? routeKey);
        const waitTime = Math.max(0, Math.ceil(error.retryAfter * 1000));
        const now = Date.now();
        const bucket = this.bucketStates.get(bucketKey) ?? {
            delayUntil: 0,
            extraBackoff: 0,
            remaining: 0
        };
        const existingDelayPassed = bucket.delayUntil <= now;
        const extraBackoff = existingDelayPassed
            ? Math.min(bucket.extraBackoff ? bucket.extraBackoff * 2 : 1000, 60_000)
            : (bucket.extraBackoff ?? 0);
        const nextAvailable = now + waitTime + extraBackoff;
        this.bucketStates.set(bucketKey, {
            delayUntil: nextAvailable,
            extraBackoff,
            remaining: 0
        });
        this.routeBuckets.set(routeKey, bucketKey);
        if (error.scope === "global") {
            this.globalRateLimitUntil = nextAvailable;
        }
    }
    updateBucketFromHeaders(routeKey, path, response) {
        const bucketId = response.headers.get("X-RateLimit-Bucket");
        const remainingRaw = response.headers.get("X-RateLimit-Remaining");
        const resetAfterRaw = response.headers.get("X-RateLimit-Reset-After");
        const hasInfo = !!bucketId || !!remainingRaw || !!resetAfterRaw;
        if (!hasInfo)
            return;
        const key = bucketId
            ? this.getBucketKey(routeKey, path, bucketId)
            : (this.routeBuckets.get(routeKey) ?? routeKey);
        if (bucketId)
            this.routeBuckets.set(routeKey, key);
        const remaining = remainingRaw ? Number(remainingRaw) : undefined;
        const resetAfter = resetAfterRaw ? Number(resetAfterRaw) * 1000 : undefined;
        const now = Date.now();
        const bucket = this.bucketStates.get(key) ?? {
            delayUntil: 0,
            extraBackoff: 0,
            remaining: 1
        };
        if (typeof remaining === "number" && !Number.isNaN(remaining)) {
            bucket.remaining = remaining;
        }
        if (typeof resetAfter === "number" &&
            !Number.isNaN(resetAfter) &&
            bucket.remaining <= 0) {
            bucket.delayUntil = now + resetAfter;
        }
        else if (bucket.remaining > 0) {
            bucket.delayUntil = 0;
        }
        bucket.extraBackoff = 0;
        this.bucketStates.set(key, bucket);
    }
    getBucketKey(routeKey, path, bucketId) {
        if (!bucketId)
            return routeKey;
        const major = this.getMajorParameter(path);
        return major ? `${bucketId}:${major}` : bucketId;
    }
    getMajorParameter(path) {
        const segments = path.split("/");
        for (let index = 0; index < segments.length; index += 1) {
            const segment = segments[index];
            const prev = segments[index - 1];
            if (prev === "channels" || prev === "guilds") {
                return segment;
            }
            if (prev === "webhooks") {
                const webhookToken = segments[index + 1];
                return webhookToken ? `${segment}/${webhookToken}` : segment;
            }
        }
        return null;
    }
    getRouteKey(method, path) {
        const segments = path.split("/");
        const normalized = segments
            .map((segment, index) => {
            if (!/^\d{16,}$/.test(segment))
                return segment;
            const prev = segments[index - 1];
            if (prev && ["channels", "guilds"].includes(prev)) {
                return segment;
            }
            if (prev === "webhooks") {
                return segment;
            }
            if (segments[index - 2] === "webhooks") {
                return segment;
            }
            return ":id";
        })
            .join("/");
        return `${method}:${normalized}`;
    }
    clearQueue() {
        this.queue = [];
    }
    get queueSize() {
        return this.queue.length;
    }
    abortAllRequests() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.clearQueue();
    }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));
//# sourceMappingURL=RequestClient.js.map