import retry from "async-retry";
import { DownloadFile } from "../../types.js";
import BaseDownloadEngineWriteStream from "./base-download-engine-write-stream.js";
type DownloadEngineWriteStreamOptionsBrowser = {
    retry?: retry.Options;
    file?: DownloadFile;
};
export type DownloadEngineWriteStreamBrowserWriter = (cursor: number, buffer: Uint8Array, options: DownloadEngineWriteStreamOptionsBrowser) => Promise<void> | void;
export default class DownloadEngineWriteStreamBrowser extends BaseDownloadEngineWriteStream {
    protected readonly _writer?: DownloadEngineWriteStreamBrowserWriter;
    readonly options: DownloadEngineWriteStreamOptionsBrowser;
    protected _memory: Uint8Array;
    protected _bytesWritten: number;
    get writerClosed(): boolean | 0 | undefined;
    constructor(_writer?: DownloadEngineWriteStreamBrowserWriter, options?: DownloadEngineWriteStreamOptionsBrowser);
    protected _ensureBuffer(length: number): Uint8Array;
    write(cursor: number, buffer: Uint8Array): void | Promise<void>;
    get result(): Uint8Array;
    resultAsBlobURL(): string;
    resultAsText(): string;
}
export {};
