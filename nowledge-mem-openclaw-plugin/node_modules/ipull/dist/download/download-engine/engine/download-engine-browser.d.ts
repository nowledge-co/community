import { SaveProgressInfo } from "../types.js";
import DownloadEngineFile from "../download-file/download-engine-file.js";
import DownloadEngineWriteStreamBrowser, { DownloadEngineWriteStreamBrowserWriter } from "../streams/download-engine-write-stream/download-engine-write-stream-browser.js";
import BaseDownloadEngine, { BaseDownloadEngineOptions } from "./base-download-engine.js";
import BaseDownloadEngineWriteStream from "../streams/download-engine-write-stream/base-download-engine-write-stream.js";
import BaseDownloadEngineFetchStream from "../streams/download-engine-fetch-stream/base-download-engine-fetch-stream.js";
export type DownloadEngineOptionsBrowser = BaseDownloadEngineOptions & {
    onWrite?: DownloadEngineWriteStreamBrowserWriter;
    progress?: SaveProgressInfo;
    fetchStrategy?: "xhr" | "fetch";
};
export type DownloadEngineOptionsCustomFetchBrowser = DownloadEngineOptionsBrowser & {
    partURLs: string[];
    fetchStream: BaseDownloadEngineFetchStream;
};
export type DownloadEngineOptionsBrowserConstructor<WriteStream = DownloadEngineWriteStreamBrowser> = DownloadEngineOptionsCustomFetchBrowser & {
    writeStream: WriteStream;
};
/**
 * Download engine for browser
 */
export default class DownloadEngineBrowser<WriteStream extends BaseDownloadEngineWriteStream = BaseDownloadEngineWriteStream> extends BaseDownloadEngine {
    readonly options: DownloadEngineOptionsBrowserConstructor<WriteStream>;
    protected constructor(engine: DownloadEngineFile, _options: DownloadEngineOptionsBrowserConstructor<WriteStream>);
    get writeStream(): Omit<WriteStream, "write" | "close">;
    /**
     * Download file
     */
    static createFromOptions(options: DownloadEngineOptionsBrowser): Promise<DownloadEngineBrowser<DownloadEngineWriteStreamBrowser>>;
    protected static _createFromOptionsWithCustomFetch(options: DownloadEngineOptionsCustomFetchBrowser): Promise<DownloadEngineBrowser<DownloadEngineWriteStreamBrowser>>;
    protected static _validateOptions(options: DownloadEngineOptionsBrowser): void;
}
