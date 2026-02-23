import { EventEmitter } from "eventemitter3";
import { FormattedStatus } from "../../transfer-visualize/format-transfer-status.js";
import ProgressStatisticsBuilder, { ProgressStatusWithIndex } from "../../transfer-visualize/progress-statistics-builder.js";
import BaseDownloadEngine, { BaseDownloadEngineEvents } from "./base-download-engine.js";
type DownloadEngineMultiAllowedEngines = BaseDownloadEngine;
type DownloadEngineMultiDownloadEvents<Engine = DownloadEngineMultiAllowedEngines> = BaseDownloadEngineEvents & {
    childDownloadStarted: (engine: Engine) => void;
    childDownloadClosed: (engine: Engine) => void;
};
export type DownloadEngineMultiDownloadOptions = {
    parallelDownloads?: number;
};
export default class DownloadEngineMultiDownload<Engine extends DownloadEngineMultiAllowedEngines = DownloadEngineMultiAllowedEngines> extends EventEmitter<DownloadEngineMultiDownloadEvents> {
    readonly downloads: Engine[];
    readonly options: DownloadEngineMultiDownloadOptions;
    protected _aborted: boolean;
    protected _activeEngines: Set<Engine>;
    protected _progressStatisticsBuilder: ProgressStatisticsBuilder;
    protected _downloadStatues: (ProgressStatusWithIndex | FormattedStatus)[];
    protected _closeFiles: (() => Promise<void>)[];
    protected _lastStatus?: ProgressStatusWithIndex;
    protected _loadingDownloads: number;
    protected constructor(engines: (DownloadEngineMultiAllowedEngines | DownloadEngineMultiDownload)[], options: DownloadEngineMultiDownloadOptions);
    get downloadStatues(): (FormattedStatus | ProgressStatusWithIndex)[];
    get status(): ProgressStatusWithIndex;
    get downloadSize(): number;
    protected _init(): void;
    private _addEngine;
    addDownload(engine: Engine | DownloadEngineMultiDownload<any> | Promise<Engine | DownloadEngineMultiDownload<any>>): Promise<void>;
    download(): Promise<void>;
    private _changeEngineFinishDownload;
    private _finishEnginesDownload;
    pause(): void;
    resume(): void;
    close(): Promise<void>;
    protected static _extractEngines<Engine>(engines: Engine[]): any[];
    static fromEngines<Engine extends DownloadEngineMultiAllowedEngines>(engines: (Engine | Promise<Engine>)[], options?: DownloadEngineMultiDownloadOptions): Promise<DownloadEngineMultiDownload<BaseDownloadEngine>>;
}
export {};
