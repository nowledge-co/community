import BaseDownloadEngineFetchStream, { MIN_LENGTH_FOR_MORE_INFO_REQUEST } from "./base-download-engine-fetch-stream.js";
import InvalidContentLengthError from "./errors/invalid-content-length-error.js";
import SmartChunkSplit from "./utils/smart-chunk-split.js";
import { parseContentDisposition } from "./utils/content-disposition.js";
import StatusCodeError from "./errors/status-code-error.js";
import { parseHttpContentRange } from "./utils/httpRange.js";
import { browserCheck } from "./utils/browserCheck.js";
export default class DownloadEngineFetchStreamFetch extends BaseDownloadEngineFetchStream {
    _fetchDownloadInfoWithHEAD = false;
    transferAction = "Downloading";
    withSubState(state) {
        const fetchStream = new DownloadEngineFetchStreamFetch(this.options);
        return this.cloneState(state, fetchStream);
    }
    async fetchWithoutRetryChunks(callback) {
        const headers = {
            accept: "*/*",
            ...this.options.headers
        };
        if (this.state.rangeSupport) {
            headers.range = `bytes=${this._startSize}-${this._endSize - 1}`;
        }
        const controller = new AbortController();
        const response = await fetch(this.appendToURL(this.state.url), {
            headers,
            signal: controller.signal
        });
        if (response.status < 200 || response.status >= 300) {
            throw new StatusCodeError(this.state.url, response.status, response.statusText, headers);
        }
        const contentLength = parseHttpContentRange(response.headers.get("content-range"))?.length ?? parseInt(response.headers.get("content-length"));
        const expectedContentLength = this._endSize - this._startSize;
        if (this.state.rangeSupport && contentLength !== expectedContentLength) {
            throw new InvalidContentLengthError(expectedContentLength, contentLength);
        }
        this.on("aborted", () => {
            controller.abort();
        });
        const reader = response.body.getReader();
        return await this.chunkGenerator(callback, () => reader.read());
    }
    async fetchDownloadInfoWithoutRetry(url) {
        if (this._fetchDownloadInfoWithHEAD) {
            try {
                return this.fetchDownloadInfoWithoutRetryByMethod(url, "HEAD");
            }
            catch (error) {
                if (!(error instanceof StatusCodeError)) {
                    throw error;
                }
                this._fetchDownloadInfoWithHEAD = false;
            }
        }
        return this.fetchDownloadInfoWithoutRetryByMethod(url, "GET");
    }
    async fetchDownloadInfoWithoutRetryByMethod(url, method = "HEAD") {
        const response = await fetch(url, {
            method: method,
            headers: {
                "Accept-Encoding": "identity",
                ...this.options.headers
            }
        });
        if (response.status < 200 || response.status >= 300) {
            throw new StatusCodeError(url, response.status, response.statusText, this.options.headers, DownloadEngineFetchStreamFetch.convertHeadersToRecord(response.headers));
        }
        const acceptRange = this.options.acceptRangeIsKnown ?? response.headers.get("accept-ranges") === "bytes";
        const fileName = parseContentDisposition(response.headers.get("content-disposition"));
        let length = parseInt(response.headers.get("content-length")) || 0;
        if (response.headers.get("content-encoding") || browserCheck() && MIN_LENGTH_FOR_MORE_INFO_REQUEST < length) {
            length = acceptRange ? await this.fetchDownloadInfoWithoutRetryContentRange(url, method === "GET" ? response : undefined) : 0;
        }
        return {
            length,
            acceptRange,
            newURL: response.url,
            fileName
        };
    }
    async fetchDownloadInfoWithoutRetryContentRange(url, response) {
        const responseGet = response ?? await fetch(url, {
            method: "GET",
            headers: {
                accept: "*/*",
                ...this.options.headers,
                range: "bytes=0-0"
            }
        });
        const contentRange = responseGet.headers.get("content-range");
        return parseHttpContentRange(contentRange)?.size || 0;
    }
    async chunkGenerator(callback, getNextChunk) {
        const smartSplit = new SmartChunkSplit(callback, this.state);
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const { done, value } = await getNextChunk();
            await this.paused;
            if (done || this.aborted)
                break;
            smartSplit.addChunk(value);
            this.state.onProgress?.(smartSplit.savedLength);
        }
        smartSplit.sendLeftovers();
    }
    static convertHeadersToRecord(headers) {
        const headerObj = {};
        headers.forEach((value, key) => {
            headerObj[key] = value;
        });
        return headerObj;
    }
}
//# sourceMappingURL=download-engine-fetch-stream-fetch.js.map