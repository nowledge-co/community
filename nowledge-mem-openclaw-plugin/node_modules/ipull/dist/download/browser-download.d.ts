import DownloadEngineBrowser, { DownloadEngineOptionsBrowser } from "./download-engine/engine/download-engine-browser.js";
import DownloadEngineMultiDownload from "./download-engine/engine/download-engine-multi-download.js";
export type DownloadFileBrowserOptions = DownloadEngineOptionsBrowser & {
    /** @deprecated use partURLs instead */
    partsURL?: string[];
};
/**
 * Download one file in the browser environment.
 */
export declare function downloadFileBrowser(options: DownloadFileBrowserOptions): Promise<DownloadEngineBrowser<import("./download-engine/streams/download-engine-write-stream/download-engine-write-stream-browser.js").default>>;
/**
 * Download multiple files in the browser environment.
 */
export declare function downloadSequenceBrowser(...downloads: (DownloadEngineBrowser | Promise<DownloadEngineBrowser>)[]): Promise<DownloadEngineMultiDownload<import("../index.js").BaseDownloadEngine>>;
