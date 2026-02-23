import DownloadEngineNodejs, { DownloadEngineOptionsNodejs } from "./download-engine/engine/download-engine-nodejs.js";
import BaseDownloadEngine from "./download-engine/engine/base-download-engine.js";
import DownloadEngineMultiDownload, { DownloadEngineMultiDownloadOptions } from "./download-engine/engine/download-engine-multi-download.js";
import { CliProgressDownloadEngineOptions } from "./transfer-visualize/transfer-cli/cli-animation-wrapper.js";
export type DownloadFileOptions = DownloadEngineOptionsNodejs & CliProgressDownloadEngineOptions & {
    /** @deprecated use partURLs instead */
    partsURL?: string[];
};
/**
 * Download one file with CLI progress
 */
export declare function downloadFile(options: DownloadFileOptions): Promise<DownloadEngineNodejs<import("./download-engine/streams/download-engine-write-stream/download-engine-write-stream-nodejs.js").default>>;
export type DownloadSequenceOptions = CliProgressDownloadEngineOptions & DownloadEngineMultiDownloadOptions & {
    fetchStrategy?: "localFile" | "fetch";
};
/**
 * Download multiple files with CLI progress
 */
export declare function downloadSequence(options?: DownloadSequenceOptions | DownloadEngineNodejs | Promise<DownloadEngineNodejs>, ...downloads: (DownloadEngineNodejs | Promise<DownloadEngineNodejs>)[]): Promise<DownloadEngineMultiDownload<BaseDownloadEngine>>;
