import BaseDownloadEngine from "../download-engine/engine/base-download-engine.js";
import { EventEmitter } from "eventemitter3";
import { FormattedStatus } from "./format-transfer-status.js";
import DownloadEngineFile from "../download-engine/download-file/download-engine-file.js";
import { DownloadStatus } from "../download-engine/download-file/progress-status-file.js";
import DownloadEngineMultiDownload from "../download-engine/engine/download-engine-multi-download.js";
export type ProgressStatusWithIndex = FormattedStatus & {
    index: number;
};
interface CliProgressBuilderEvents {
    progress: (progress: ProgressStatusWithIndex) => void;
}
export type AnyEngine = DownloadEngineFile | BaseDownloadEngine | DownloadEngineMultiDownload;
export default class ProgressStatisticsBuilder extends EventEmitter<CliProgressBuilderEvents> {
    private _engines;
    private _activeTransfers;
    private _totalBytes;
    private _transferredBytes;
    private _activeDownloadPart;
    private _startTime;
    private _statistics;
    private _lastStatus?;
    downloadStatus: DownloadStatus;
    get totalBytes(): number;
    get transferredBytesWithActiveTransfers(): number;
    get status(): ProgressStatusWithIndex | undefined;
    /**
     * Add engines to the progress statistics builder, will only add engines once
     */
    add(...engines: AnyEngine[]): void;
    private _initEvents;
    private _sendProgress;
    static oneStatistics(engine: DownloadEngineFile): FormattedStatus;
    static loadingStatusEmptyStatistics(): FormattedStatus;
}
export {};
