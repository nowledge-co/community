import { DownloadFile } from "../types.js";
import DownloadEngineFile from "../download-file/download-engine-file.js";
import DownloadEngineWriteStreamNodejs from "../streams/download-engine-write-stream/download-engine-write-stream-nodejs.js";
import BaseDownloadEngine, { BaseDownloadEngineOptions } from "./base-download-engine.js";
import BaseDownloadEngineFetchStream from "../streams/download-engine-fetch-stream/base-download-engine-fetch-stream.js";
export declare const PROGRESS_FILE_EXTENSION = ".ipull";
type PathOptions = {
    directory: string;
} | {
    savePath: string;
};
export type DownloadEngineOptionsNodejs = PathOptions & BaseDownloadEngineOptions & {
    fileName?: string;
    fetchStrategy?: "localFile" | "fetch";
    skipExisting?: boolean;
};
export type DownloadEngineOptionsNodejsCustomFetch = DownloadEngineOptionsNodejs & {
    partURLs: string[];
    fetchStream: BaseDownloadEngineFetchStream;
};
export type DownloadEngineOptionsNodejsConstructor<WriteStream = DownloadEngineWriteStreamNodejs> = DownloadEngineOptionsNodejsCustomFetch & {
    writeStream: WriteStream;
};
/**
 * Download engine for Node.js
 */
export default class DownloadEngineNodejs<T extends DownloadEngineWriteStreamNodejs = DownloadEngineWriteStreamNodejs> extends BaseDownloadEngine {
    readonly options: DownloadEngineOptionsNodejsConstructor<T>;
    protected constructor(engine: DownloadEngineFile, _options: DownloadEngineOptionsNodejsConstructor<T>);
    protected _initEvents(): void;
    /**
     * The file path with the progress extension or the final file path if the download is finished
     */
    get fileAbsolutePath(): string;
    /**
     * The final file path (without the progress extension)
     */
    get finalFileAbsolutePath(): string;
    /**
     * Abort the download & delete the file (**even if** the download is finished)
     * @deprecated use `close` with flag `deleteFile` instead
     *
     * TODO: remove in the next major version
     */
    closeAndDeleteFile(): Promise<void>;
    /**
     * Close the download engine
     * @param deleteTempFile {boolean} - delete the temp file (when the download is **not finished**).
     * @param deleteFile {boolean} - delete the **temp** or **final file** (clean everything up).
     */
    close({ deleteTempFile, deleteFile }?: {
        deleteTempFile?: boolean;
        deleteFile?: boolean;
    }): Promise<void>;
    /**
     * Download/copy a file
     *
     * if `fetchStrategy` is defined as "localFile" it will copy the file, otherwise it will download it
     * By default, it will guess the strategy based on the URL
     */
    static createFromOptions(options: DownloadEngineOptionsNodejs): Promise<DownloadEngineNodejs<DownloadEngineWriteStreamNodejs>>;
    protected static _createFromOptionsWithCustomFetch(options: DownloadEngineOptionsNodejsCustomFetch): Promise<DownloadEngineNodejs<DownloadEngineWriteStreamNodejs>>;
    protected static _createDownloadLocation(download: DownloadFile, options: DownloadEngineOptionsNodejs): string;
    protected static _validateOptions(options: DownloadEngineOptionsNodejs): void;
    protected static _guessFetchStrategy(url: string): "localFile" | "fetch";
}
export {};
