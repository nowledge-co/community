import retry from "async-retry";
import BaseDownloadEngineWriteStream from "./base-download-engine-write-stream.js";
export type DownloadEngineWriteStreamOptionsNodeJS = {
    retry?: retry.Options;
    mode: string;
};
export default class DownloadEngineWriteStreamNodejs extends BaseDownloadEngineWriteStream {
    path: string;
    finalPath: string;
    private static _allFd;
    private static _finalizationRegistry;
    private _finalToken;
    private _fd;
    private _fileWriteFinished;
    readonly options: DownloadEngineWriteStreamOptionsNodeJS;
    fileSize: number;
    constructor(path: string, finalPath: string, options?: Partial<DownloadEngineWriteStreamOptionsNodeJS>);
    private _ensureFileOpen;
    write(cursor: number, buffer: Uint8Array): Promise<void>;
    ftruncate(size?: number): Promise<void>;
    saveMedataAfterFile(data: any): Promise<void>;
    loadMetadataAfterFileWithoutRetry(): Promise<any>;
    private _writeWithoutRetry;
    close(): Promise<void>;
}
