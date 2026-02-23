import ProgressStatusFile, { DownloadStatus, ProgressStatus } from "./progress-status-file.js";
import { DownloadFile, SaveProgressInfo } from "../types.js";
import BaseDownloadEngineFetchStream from "../streams/download-engine-fetch-stream/base-download-engine-fetch-stream.js";
import BaseDownloadEngineWriteStream from "../streams/download-engine-write-stream/base-download-engine-write-stream.js";
import retry from "async-retry";
import { EventEmitter } from "eventemitter3";
import { AvailablePrograms } from "./download-programs/switch-program.js";
import BaseDownloadProgram from "./download-programs/base-download-program.js";
export type DownloadEngineFileOptions = {
    chunkSize?: number;
    parallelStreams?: number;
    retry?: retry.Options;
    comment?: string;
    fetchStream: BaseDownloadEngineFetchStream;
    writeStream: BaseDownloadEngineWriteStream;
    onFinishAsync?: () => Promise<void>;
    onStartedAsync?: () => Promise<void>;
    onCloseAsync?: () => Promise<void>;
    onSaveProgressAsync?: (progress: SaveProgressInfo) => Promise<void>;
    programType?: AvailablePrograms;
};
export type DownloadEngineFileOptionsWithDefaults = DownloadEngineFileOptions & {
    chunkSize: number;
    parallelStreams: number;
};
export type DownloadEngineFileEvents = {
    start: () => void;
    paused: () => void;
    resumed: () => void;
    progress: (progress: ProgressStatus) => void;
    save: (progress: SaveProgressInfo) => void;
    finished: () => void;
    closed: () => void;
    [key: string]: any;
};
export default class DownloadEngineFile extends EventEmitter<DownloadEngineFileEvents> {
    readonly file: DownloadFile;
    options: DownloadEngineFileOptionsWithDefaults;
    protected _progress: SaveProgressInfo;
    protected _closed: boolean;
    protected _progressStatus: ProgressStatusFile;
    protected _activeStreamBytes: {
        [key: number]: number;
    };
    protected _activeProgram?: BaseDownloadProgram;
    protected _downloadStatus: DownloadStatus;
    private _latestProgressDate;
    constructor(file: DownloadFile, options: DownloadEngineFileOptions);
    private _createProgressFlags;
    get downloadSize(): number;
    get fileName(): string;
    get status(): ProgressStatus;
    protected get _activePart(): import("../types.js").DownloadFilePart;
    private get _downloadedPartsSize();
    private get _activeDownloadedChunkSize();
    get transferredBytes(): number;
    protected _emptyChunksForPart(part: number): any[];
    private _initEventReloadStatus;
    private _initProgress;
    download(): Promise<void>;
    protected _downloadSlice(startChunk: number, endChunk: number): Promise<void>;
    protected _saveProgress(): Promise<void> | undefined;
    protected _sendProgressDownloadPart(): void;
    pause(): void;
    resume(): void;
    close(): Promise<void>;
    finished(comment?: string): void;
    [Symbol.dispose](): Promise<void>;
}
