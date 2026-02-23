import { EventEmitter } from "eventemitter3";
import ProgressStatisticsBuilder from "../../transfer-visualize/progress-statistics-builder.js";
import DownloadAlreadyStartedError from "./error/download-already-started-error.js";
import { concurrency } from "./utils/concurrency.js";
import { DownloadFlags, DownloadStatus } from "../download-file/progress-status-file.js";
import { NoDownloadEngineProvidedError } from "./error/no-download-engine-provided-error.js";
const DEFAULT_PARALLEL_DOWNLOADS = 1;
export default class DownloadEngineMultiDownload extends EventEmitter {
    downloads;
    options;
    _aborted = false;
    _activeEngines = new Set();
    _progressStatisticsBuilder = new ProgressStatisticsBuilder();
    _downloadStatues = [];
    _closeFiles = [];
    _lastStatus;
    _loadingDownloads = 0;
    constructor(engines, options) {
        super();
        this.downloads = DownloadEngineMultiDownload._extractEngines(engines);
        this.options = options;
        this._init();
    }
    get downloadStatues() {
        return this._downloadStatues;
    }
    get status() {
        if (!this._lastStatus) {
            throw new NoDownloadEngineProvidedError();
        }
        return this._lastStatus;
    }
    get downloadSize() {
        return this.downloads.reduce((acc, engine) => acc + engine.downloadSize, 0);
    }
    _init() {
        this._progressStatisticsBuilder.downloadStatus = DownloadStatus.NotStarted;
        this._progressStatisticsBuilder.on("progress", progress => {
            progress = {
                ...progress,
                downloadFlags: progress.downloadFlags.concat([DownloadFlags.DownloadSequence])
            };
            this._lastStatus = progress;
            this.emit("progress", progress);
        });
        let index = 0;
        for (const engine of this.downloads) {
            this._addEngine(engine, index++);
        }
        // Prevent multiple progress events on adding engines
        this._progressStatisticsBuilder.add(...this.downloads);
    }
    _addEngine(engine, index) {
        this._downloadStatues[index] = engine.status;
        engine.on("progress", (progress) => {
            this._downloadStatues[index] = progress;
        });
        this._changeEngineFinishDownload(engine);
    }
    async addDownload(engine) {
        const index = this.downloads.length + this._loadingDownloads;
        this._downloadStatues[index] = ProgressStatisticsBuilder.loadingStatusEmptyStatistics();
        this._loadingDownloads++;
        this._progressStatisticsBuilder._totalDownloadParts++;
        const awaitEngine = engine instanceof Promise ? await engine : engine;
        this._progressStatisticsBuilder._totalDownloadParts--;
        this._loadingDownloads--;
        if (awaitEngine instanceof DownloadEngineMultiDownload) {
            let countEngines = 0;
            for (const subEngine of awaitEngine.downloads) {
                this._addEngine(subEngine, index + countEngines++);
                this.downloads.push(subEngine);
            }
            this._progressStatisticsBuilder.add(...awaitEngine.downloads);
        }
        else {
            this._addEngine(awaitEngine, index);
            this.downloads.push(awaitEngine);
            this._progressStatisticsBuilder.add(awaitEngine);
        }
    }
    async download() {
        if (this._activeEngines.size) {
            throw new DownloadAlreadyStartedError();
        }
        this._progressStatisticsBuilder.downloadStatus = DownloadStatus.Active;
        this.emit("start");
        const concurrencyCount = this.options.parallelDownloads ?? DEFAULT_PARALLEL_DOWNLOADS;
        await concurrency(this.downloads, concurrencyCount, async (engine) => {
            if (this._aborted)
                return;
            this._activeEngines.add(engine);
            this.emit("childDownloadStarted", engine);
            await engine.download();
            this.emit("childDownloadClosed", engine);
            this._activeEngines.delete(engine);
        });
        this._progressStatisticsBuilder.downloadStatus = DownloadStatus.Finished;
        this.emit("finished");
        await this._finishEnginesDownload();
        await this.close();
    }
    _changeEngineFinishDownload(engine) {
        const options = engine._fileEngineOptions;
        const onFinishAsync = options.onFinishAsync;
        const onCloseAsync = options.onCloseAsync;
        options.onFinishAsync = undefined;
        options.onCloseAsync = undefined;
        this._closeFiles.push(async () => {
            await onFinishAsync?.();
            await options.writeStream.close();
            await onCloseAsync?.();
        });
    }
    async _finishEnginesDownload() {
        await Promise.all(this._closeFiles.map(func => func()));
    }
    pause() {
        this._progressStatisticsBuilder.downloadStatus = DownloadStatus.Paused;
        this._activeEngines.forEach(engine => engine.pause());
    }
    resume() {
        this._progressStatisticsBuilder.downloadStatus = DownloadStatus.Active;
        this._activeEngines.forEach(engine => engine.resume());
    }
    async close() {
        if (this._aborted)
            return;
        this._aborted = true;
        if (this._progressStatisticsBuilder.downloadStatus !== DownloadStatus.Finished) {
            this._progressStatisticsBuilder.downloadStatus = DownloadStatus.Cancelled;
        }
        const closePromises = Array.from(this._activeEngines)
            .map(engine => engine.close());
        await Promise.all(closePromises);
        this.emit("closed");
    }
    static _extractEngines(engines) {
        return engines.map(engine => {
            if (engine instanceof DownloadEngineMultiDownload) {
                return engine.downloads;
            }
            return engine;
        })
            .flat();
    }
    static async fromEngines(engines, options = {}) {
        return new DownloadEngineMultiDownload(await Promise.all(engines), options);
    }
}
//# sourceMappingURL=download-engine-multi-download.js.map