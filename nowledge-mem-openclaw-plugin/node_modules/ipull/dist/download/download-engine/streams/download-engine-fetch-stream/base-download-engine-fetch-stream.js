import retry from "async-retry";
import { retryAsyncStatementSimple } from "./utils/retry-async-statement.js";
import { EventEmitter } from "eventemitter3";
import HttpError from "./errors/http-error.js";
import StatusCodeError from "./errors/status-code-error.js";
import sleep from "sleep-promise";
export const MIN_LENGTH_FOR_MORE_INFO_REQUEST = 1024 * 1024 * 3; // 3MB
const DEFAULT_OPTIONS = {
    retryOnServerError: true,
    retry: {
        retries: 150,
        factor: 1.5,
        minTimeout: 200,
        maxTimeout: 5_000
    },
    tryHeadersDelay: 50
};
export default class BaseDownloadEngineFetchStream extends EventEmitter {
    programType;
    options = {};
    state = null;
    paused;
    aborted = false;
    _pausedResolve;
    errorCount = { value: 0 };
    constructor(options = {}) {
        super();
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.initEvents();
    }
    get _startSize() {
        return this.state.startChunk * this.state.chunkSize;
    }
    get _endSize() {
        return Math.min(this.state.endChunk * this.state.chunkSize, this.state.totalSize);
    }
    initEvents() {
        this.on("aborted", () => {
            this.aborted = true;
            this._pausedResolve?.();
        });
        this.on("paused", () => {
            this.paused = new Promise((resolve) => {
                this._pausedResolve = resolve;
            });
        });
        this.on("resumed", () => {
            this._pausedResolve?.();
            this._pausedResolve = undefined;
            this.paused = undefined;
        });
    }
    cloneState(state, fetchStream) {
        fetchStream.state = state;
        fetchStream.errorCount = this.errorCount;
        fetchStream.on("errorCountIncreased", this.emit.bind(this, "errorCountIncreased"));
        this.on("aborted", fetchStream.emit.bind(fetchStream, "aborted"));
        this.on("paused", fetchStream.emit.bind(fetchStream, "paused"));
        this.on("resumed", fetchStream.emit.bind(fetchStream, "resumed"));
        return fetchStream;
    }
    async fetchDownloadInfo(url) {
        let throwErr = null;
        const tryHeaders = "tryHeaders" in this.options && this.options.tryHeaders ? this.options.tryHeaders.slice() : [];
        const fetchDownloadInfoCallback = async () => {
            try {
                return await this.fetchDownloadInfoWithoutRetry(url);
            }
            catch (error) {
                if (error instanceof HttpError && !this.retryOnServerError(error)) {
                    if ("tryHeaders" in this.options && tryHeaders.length) {
                        this.options.headers = tryHeaders.shift();
                        await sleep(this.options.tryHeadersDelay ?? 0);
                        return await fetchDownloadInfoCallback();
                    }
                    throwErr = error;
                    return null;
                }
                this.errorCount.value++;
                this.emit("errorCountIncreased", this.errorCount.value, error);
                if (error instanceof StatusCodeError && error.retryAfter) {
                    await sleep(error.retryAfter * 1000);
                    return await fetchDownloadInfoCallback();
                }
                throw error;
            }
        };
        const response = ("defaultFetchDownloadInfo" in this.options && this.options.defaultFetchDownloadInfo) || await retry(fetchDownloadInfoCallback, this.options.retry);
        if (throwErr) {
            throw throwErr;
        }
        return response;
    }
    async fetchChunks(callback) {
        let lastStartLocation = this.state.startChunk;
        let retryResolvers = retryAsyncStatementSimple(this.options.retry);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            try {
                return await this.fetchWithoutRetryChunks(callback);
            }
            catch (error) {
                if (error?.name === "AbortError")
                    return;
                if (error instanceof HttpError && !this.retryOnServerError(error)) {
                    throw error;
                }
                this.errorCount.value++;
                this.emit("errorCountIncreased", this.errorCount.value, error);
                if (error instanceof StatusCodeError && error.retryAfter) {
                    await sleep(error.retryAfter * 1000);
                    continue;
                }
                if (lastStartLocation !== this.state.startChunk) {
                    lastStartLocation = this.state.startChunk;
                    retryResolvers = retryAsyncStatementSimple(this.options.retry);
                }
                await retryResolvers(error);
            }
        }
    }
    close() {
        this.emit("aborted");
    }
    appendToURL(url) {
        const parsed = new URL(url);
        if (this.options.ignoreIfRangeWithQueryParams) {
            const randomText = Math.random()
                .toString(36);
            parsed.searchParams.set("_ignore", randomText);
        }
        return parsed.href;
    }
    retryOnServerError(error) {
        return Boolean(this.options.retryOnServerError) && error instanceof StatusCodeError &&
            (error.statusCode >= 500 || error.statusCode === 429);
    }
}
//# sourceMappingURL=base-download-engine-fetch-stream.js.map