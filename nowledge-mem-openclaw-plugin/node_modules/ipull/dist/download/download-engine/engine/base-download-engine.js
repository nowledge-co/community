import UrlInputError from "./error/url-input-error.js";
import { EventEmitter } from "eventemitter3";
import ProgressStatisticsBuilder from "../../transfer-visualize/progress-statistics-builder.js";
import DownloadAlreadyStartedError from "./error/download-already-started-error.js";
import StatusCodeError from "../streams/download-engine-fetch-stream/errors/status-code-error.js";
import { InvalidOptionError } from "./error/InvalidOptionError.js";
const IGNORE_HEAD_STATUS_CODES = [405, 501, 404];
export default class BaseDownloadEngine extends EventEmitter {
    options;
    _engine;
    _progressStatisticsBuilder = new ProgressStatisticsBuilder();
    _downloadStarted = false;
    _latestStatus;
    constructor(engine, options) {
        super();
        this.options = options;
        this._engine = engine;
        this._progressStatisticsBuilder.add(engine);
        this._initEvents();
    }
    get file() {
        return this._engine.file;
    }
    get downloadSize() {
        return this._engine.downloadSize;
    }
    get fileName() {
        return this.file.localFileName;
    }
    get status() {
        return this._latestStatus ?? ProgressStatisticsBuilder.oneStatistics(this._engine);
    }
    get downloadStatues() {
        return [this.status];
    }
    /**
     * @internal
     */
    get _fileEngineOptions() {
        return this._engine.options;
    }
    _initEvents() {
        this._engine.on("start", () => {
            return this.emit("start");
        });
        this._engine.on("save", (info) => {
            return this.emit("save", info);
        });
        this._engine.on("finished", () => {
            return this.emit("finished");
        });
        this._engine.on("closed", () => {
            return this.emit("closed");
        });
        this._engine.on("paused", () => {
            return this.emit("paused");
        });
        this._engine.on("resumed", () => {
            return this.emit("resumed");
        });
        this._progressStatisticsBuilder.on("progress", (status) => {
            this._latestStatus = status;
            return this.emit("progress", status);
        });
    }
    async download() {
        if (this._downloadStarted) {
            throw new DownloadAlreadyStartedError();
        }
        try {
            this._downloadStarted = true;
            await this._engine.download();
        }
        finally {
            await this.close();
        }
    }
    pause() {
        return this._engine.pause();
    }
    resume() {
        return this._engine.resume();
    }
    close() {
        return this._engine.close();
    }
    static async _createDownloadFile(parts, fetchStream) {
        const localFileName = decodeURIComponent(new URL(parts[0], "https://example").pathname.split("/")
            .pop() || "");
        const downloadFile = {
            totalSize: 0,
            parts: [],
            localFileName
        };
        let counter = 0;
        for (const part of parts) {
            try {
                const { length, acceptRange, newURL, fileName } = await fetchStream.fetchDownloadInfo(part);
                const downloadURL = newURL ?? part;
                const size = length || 0;
                downloadFile.totalSize += size;
                downloadFile.parts.push({
                    downloadURL,
                    size,
                    acceptRange: size > 0 && acceptRange
                });
                if (counter++ === 0 && fileName) {
                    downloadFile.localFileName = fileName;
                }
            }
            catch (error) {
                if (error instanceof StatusCodeError && IGNORE_HEAD_STATUS_CODES.includes(error.statusCode)) {
                    // if the server does not support HEAD request, we will skip that step
                    downloadFile.parts.push({
                        downloadURL: part,
                        size: 0,
                        acceptRange: false
                    });
                    continue;
                }
                throw error;
            }
        }
        return downloadFile;
    }
    static _validateURL(options) {
        if ("partURLs" in options && "url" in options) {
            throw new UrlInputError("Either `partURLs` or `url` should be provided, not both");
        }
        if (!("partURLs" in options) && !("url" in options)) {
            throw new UrlInputError("Either `partURLs` or `url` should be provided");
        }
    }
    static _validateOptions(options) {
        if ("tryHeaders" in options && options.tryHeaders?.length && "defaultFetchDownloadInfo" in options) {
            throw new InvalidOptionError("Cannot use `tryHeaders` with `defaultFetchDownloadInfo`");
        }
    }
}
//# sourceMappingURL=base-download-engine.js.map