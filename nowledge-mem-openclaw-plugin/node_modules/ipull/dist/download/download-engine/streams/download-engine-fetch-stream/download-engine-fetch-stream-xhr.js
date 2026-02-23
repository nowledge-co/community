import BaseDownloadEngineFetchStream, { MIN_LENGTH_FOR_MORE_INFO_REQUEST } from "./base-download-engine-fetch-stream.js";
import EmptyResponseError from "./errors/empty-response-error.js";
import StatusCodeError from "./errors/status-code-error.js";
import XhrError from "./errors/xhr-error.js";
import InvalidContentLengthError from "./errors/invalid-content-length-error.js";
import retry from "async-retry";
import { parseContentDisposition } from "./utils/content-disposition.js";
import { parseHttpContentRange } from "./utils/httpRange.js";
export default class DownloadEngineFetchStreamXhr extends BaseDownloadEngineFetchStream {
    _fetchDownloadInfoWithHEAD = true;
    programType = "chunks";
    transferAction = "Downloading";
    withSubState(state) {
        const fetchStream = new DownloadEngineFetchStreamXhr(this.options);
        return this.cloneState(state, fetchStream);
    }
    async fetchBytes(url, start, end, onProgress) {
        return await retry(async () => {
            return await this.fetchBytesWithoutRetry(url, start, end, onProgress);
        }, this.options.retry);
    }
    fetchBytesWithoutRetry(url, start, end, onProgress) {
        return new Promise((resolve, reject) => {
            const headers = {
                accept: "*/*",
                ...this.options.headers
            };
            if (this.state.rangeSupport) {
                headers.range = `bytes=${start}-${end - 1}`;
            }
            const xhr = new XMLHttpRequest();
            xhr.responseType = "arraybuffer";
            xhr.open("GET", this.appendToURL(url), true);
            for (const [key, value] of Object.entries(headers)) {
                xhr.setRequestHeader(key, value);
            }
            xhr.onload = () => {
                const contentLength = parseInt(xhr.getResponseHeader("content-length"));
                if (this.state.rangeSupport && contentLength !== end - start) {
                    throw new InvalidContentLengthError(end - start, contentLength);
                }
                if (xhr.status >= 200 && xhr.status < 300) {
                    const arrayBuffer = xhr.response;
                    if (arrayBuffer) {
                        resolve(new Uint8Array(arrayBuffer));
                    }
                    else {
                        reject(new EmptyResponseError(url, headers));
                    }
                }
                else {
                    reject(new StatusCodeError(url, xhr.status, xhr.statusText, headers));
                }
            };
            xhr.onerror = () => {
                reject(new XhrError(`Failed to fetch ${url}`));
            };
            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    onProgress?.(event.loaded);
                }
            };
            xhr.send();
            this.on("aborted", () => {
                xhr.abort();
            });
        });
    }
    async fetchChunks(callback) {
        if (this.state.rangeSupport) {
            return await this._fetchChunksRangeSupport(callback);
        }
        return await this._fetchChunksWithoutRange(callback);
    }
    fetchWithoutRetryChunks() {
        throw new Error("Method not needed, use fetchChunks instead.");
    }
    async _fetchChunksRangeSupport(callback) {
        while (this._startSize < this._endSize) {
            await this.paused;
            if (this.aborted)
                return;
            const chunk = await this.fetchBytes(this.state.url, this._startSize, this._endSize, this.state.onProgress);
            callback([chunk], this._startSize, this.state.startChunk++);
        }
    }
    async _fetchChunksWithoutRange(callback) {
        const relevantContent = await (async () => {
            const result = await this.fetchBytes(this.state.url, 0, this._endSize, this.state.onProgress);
            return result.slice(this._startSize, this._endSize || result.length);
        })();
        let totalReceivedLength = 0;
        let index = 0;
        while (totalReceivedLength < relevantContent.byteLength) {
            await this.paused;
            if (this.aborted)
                return;
            const start = totalReceivedLength;
            const end = Math.min(relevantContent.byteLength, start + this.state.chunkSize);
            const chunk = relevantContent.slice(start, end);
            totalReceivedLength += chunk.byteLength;
            callback([chunk], index * this.state.chunkSize, index++);
        }
    }
    fetchDownloadInfoWithoutRetry(url) {
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
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open(method, url, true);
            const allHeaders = {
                ...this.options.headers
            };
            for (const [key, value] of Object.entries(allHeaders)) {
                xhr.setRequestHeader(key, value);
            }
            xhr.onload = async () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    const contentLength = parseInt(xhr.getResponseHeader("content-length"));
                    const length = MIN_LENGTH_FOR_MORE_INFO_REQUEST < contentLength ? await this.fetchDownloadInfoWithoutRetryContentRange(url, method === "GET" ? xhr : undefined) : 0;
                    const fileName = parseContentDisposition(xhr.getResponseHeader("content-disposition"));
                    const acceptRange = this.options.acceptRangeIsKnown ?? xhr.getResponseHeader("Accept-Ranges") === "bytes";
                    resolve({
                        length,
                        acceptRange,
                        newURL: xhr.responseURL,
                        fileName
                    });
                }
                else {
                    reject(new StatusCodeError(url, xhr.status, xhr.statusText, this.options.headers, DownloadEngineFetchStreamXhr.convertXHRHeadersToRecord(xhr)));
                }
            };
            xhr.onerror = function () {
                reject(new XhrError(`Failed to fetch ${url}`));
            };
            xhr.send();
        });
    }
    fetchDownloadInfoWithoutRetryContentRange(url, xhrResponse) {
        const getSize = (xhr) => {
            const contentRange = xhr.getResponseHeader("Content-Range");
            return parseHttpContentRange(contentRange)?.size || 0;
        };
        if (xhrResponse) {
            return getSize(xhrResponse);
        }
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            const allHeaders = {
                accept: "*/*",
                ...this.options.headers,
                range: "bytes=0-0"
            };
            for (const [key, value] of Object.entries(allHeaders)) {
                xhr.setRequestHeader(key, value);
            }
            xhr.onload = () => {
                resolve(getSize(xhr));
            };
            xhr.onerror = () => {
                reject(new XhrError(`Failed to fetch ${url}`));
            };
            xhr.send();
        });
    }
    static convertXHRHeadersToRecord(xhr) {
        const headersString = xhr.getAllResponseHeaders();
        const headersArray = headersString.trim()
            .split(/[\r\n]+/);
        const headersObject = {};
        headersArray.forEach(line => {
            const parts = line.split(": ");
            const key = parts.shift();
            const value = parts.join(": ");
            if (key) {
                headersObject[key] = value;
            }
        });
        return headersObject;
    }
}
//# sourceMappingURL=download-engine-fetch-stream-xhr.js.map