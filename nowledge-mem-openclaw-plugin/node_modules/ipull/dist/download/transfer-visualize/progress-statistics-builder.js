import { EventEmitter } from "eventemitter3";
import TransferStatistics from "./transfer-statistics.js";
import { createFormattedStatus } from "./format-transfer-status.js";
import ProgressStatusFile, { DownloadStatus } from "../download-engine/download-file/progress-status-file.js";
export default class ProgressStatisticsBuilder extends EventEmitter {
    _engines = [];
    _activeTransfers = {};
    _totalBytes = 0;
    _transferredBytes = 0;
    /**
     * @internal
     */
    _totalDownloadParts = 0;
    _activeDownloadPart = 0;
    _startTime = 0;
    _statistics = new TransferStatistics();
    _lastStatus;
    downloadStatus = null;
    get totalBytes() {
        return this._totalBytes;
    }
    get transferredBytesWithActiveTransfers() {
        return this._transferredBytes + Object.values(this._activeTransfers)
            .reduce((acc, bytes) => acc + bytes, 0);
    }
    get status() {
        return this._lastStatus;
    }
    /**
     * Add engines to the progress statistics builder, will only add engines once
     */
    add(...engines) {
        for (const engine of engines) {
            if (!this._engines.includes(engine)) {
                this._initEvents(engine, engines.at(-1) === engine);
            }
        }
    }
    _initEvents(engine, sendProgress = false) {
        this._engines.push(engine);
        this._totalBytes += engine.downloadSize;
        const index = this._engines.length - 1;
        const downloadPartStart = this._totalDownloadParts;
        this._totalDownloadParts += engine.status.totalDownloadParts;
        engine.on("progress", (data) => {
            this._sendProgress(data, index, downloadPartStart);
        });
        engine.on("finished", () => {
            delete this._activeTransfers[index];
            this._transferredBytes += engine.downloadSize;
        });
        if (sendProgress) {
            this._sendProgress(engine.status, index, downloadPartStart);
        }
    }
    _sendProgress(data, index, downloadPartStart) {
        this._startTime ||= data.startTime;
        this._activeTransfers[index] = data.transferredBytes;
        if (downloadPartStart + data.downloadPart > this._activeDownloadPart) {
            this._activeDownloadPart = downloadPartStart + data.downloadPart;
        }
        const progress = this._statistics.updateProgress(this.transferredBytesWithActiveTransfers, this.totalBytes);
        const activeDownloads = Object.keys(this._activeTransfers).length;
        this._lastStatus = {
            ...createFormattedStatus({
                ...progress,
                downloadPart: this._activeDownloadPart,
                totalDownloadParts: this._totalDownloadParts,
                startTime: this._startTime,
                fileName: data.fileName,
                comment: data.comment,
                transferAction: data.transferAction,
                downloadStatus: this.downloadStatus || data.downloadStatus,
                endTime: activeDownloads <= 1 ? data.endTime : 0,
                downloadFlags: data.downloadFlags
            }),
            index
        };
        this.emit("progress", this._lastStatus);
    }
    static oneStatistics(engine) {
        const progress = engine.status;
        const statistics = TransferStatistics.oneStatistics(progress.transferredBytes, progress.totalBytes);
        return createFormattedStatus({
            ...progress,
            ...statistics
        });
    }
    static loadingStatusEmptyStatistics() {
        const statistics = TransferStatistics.oneStatistics(0, 0);
        const status = new ProgressStatusFile(0, "???");
        status.downloadStatus = DownloadStatus.Loading;
        return createFormattedStatus({
            ...status,
            ...statistics
        });
    }
}
//# sourceMappingURL=progress-statistics-builder.js.map