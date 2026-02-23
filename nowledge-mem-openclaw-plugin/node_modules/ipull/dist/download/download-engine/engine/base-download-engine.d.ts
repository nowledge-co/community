import { DownloadFile, SaveProgressInfo } from "../types.js";
import DownloadEngineFile, { DownloadEngineFileOptions } from "../download-file/download-engine-file.js";
import BaseDownloadEngineFetchStream, { BaseDownloadEngineFetchStreamOptions } from "../streams/download-engine-fetch-stream/base-download-engine-fetch-stream.js";
import { EventEmitter } from "eventemitter3";
import ProgressStatisticsBuilder, { ProgressStatusWithIndex } from "../../transfer-visualize/progress-statistics-builder.js";
import retry from "async-retry";
import { AvailablePrograms } from "../download-file/download-programs/switch-program.js";
export type InputURLOptions = {
    partURLs: string[];
} | {
    url: string;
};
export type BaseDownloadEngineOptions = InputURLOptions & BaseDownloadEngineFetchStreamOptions & {
    chunkSize?: number;
    parallelStreams?: number;
    retry?: retry.Options;
    comment?: string;
    programType?: AvailablePrograms;
};
export type BaseDownloadEngineEvents = {
    start: () => void;
    paused: () => void;
    resumed: () => void;
    progress: (progress: ProgressStatusWithIndex) => void;
    save: (progress: SaveProgressInfo) => void;
    finished: () => void;
    closed: () => void;
    [key: string]: any;
};
export default class BaseDownloadEngine extends EventEmitter<BaseDownloadEngineEvents> {
    readonly options: DownloadEngineFileOptions;
    protected readonly _engine: DownloadEngineFile;
    protected _progressStatisticsBuilder: ProgressStatisticsBuilder;
    protected _downloadStarted: boolean;
    protected _latestStatus?: ProgressStatusWithIndex;
    protected constructor(engine: DownloadEngineFile, options: DownloadEngineFileOptions);
    get file(): DownloadFile;
    get downloadSize(): number;
    get fileName(): string;
    get status(): import("../../transfer-visualize/format-transfer-status.js").FormattedStatus;
    get downloadStatues(): import("../../transfer-visualize/format-transfer-status.js").FormattedStatus[];
    protected _initEvents(): void;
    download(): Promise<void>;
    pause(): void;
    resume(): void;
    close(): Promise<void>;
    protected static _createDownloadFile(parts: string[], fetchStream: BaseDownloadEngineFetchStream): Promise<DownloadFile>;
    protected static _validateURL(options: InputURLOptions): void;
    protected static _validateOptions(options: BaseDownloadEngineOptions): void;
}
