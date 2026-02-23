import DownloadEngineFile from "../download-file/download-engine-file.js";
import DownloadEngineFetchStreamFetch from "../streams/download-engine-fetch-stream/download-engine-fetch-stream-fetch.js";
import DownloadEngineFetchStreamXhr from "../streams/download-engine-fetch-stream/download-engine-fetch-stream-xhr.js";
import DownloadEngineWriteStreamBrowser from "../streams/download-engine-write-stream/download-engine-write-stream-browser.js";
import BaseDownloadEngine from "./base-download-engine.js";
/**
 * Download engine for browser
 */
export default class DownloadEngineBrowser extends BaseDownloadEngine {
    options;
    constructor(engine, _options) {
        super(engine, _options);
        this.options = _options;
    }
    get writeStream() {
        return this.options.writeStream;
    }
    /**
     * Download file
     */
    static async createFromOptions(options) {
        DownloadEngineBrowser._validateOptions(options);
        const partURLs = "partURLs" in options ? options.partURLs : [options.url];
        const fetchStream = options.fetchStrategy === "xhr" ?
            new DownloadEngineFetchStreamXhr(options) : new DownloadEngineFetchStreamFetch(options);
        return DownloadEngineBrowser._createFromOptionsWithCustomFetch({ ...options, partURLs, fetchStream });
    }
    static async _createFromOptionsWithCustomFetch(options) {
        const downloadFile = await DownloadEngineBrowser._createDownloadFile(options.partURLs, options.fetchStream);
        downloadFile.downloadProgress = options.progress;
        const writeStream = new DownloadEngineWriteStreamBrowser(options.onWrite, {
            ...options,
            file: downloadFile
        });
        if (options.acceptRangeIsKnown == null) {
            const doesNotAcceptRange = downloadFile.parts.find(p => !p.acceptRange);
            if (doesNotAcceptRange) {
                console.warn(`Server does not accept range requests for "${doesNotAcceptRange.downloadURL}". Meaning fast-downloads/pausing/resuming will not work.
This may be related to cors origin policy (range header is ignored in the browser). 
If you know the server accepts range requests, you can set "acceptRangeIsKnown" to true. To dismiss this warning, set "acceptRangeIsKnown" to false.`);
            }
        }
        const allOptions = { ...options, writeStream };
        const engine = new DownloadEngineFile(downloadFile, allOptions);
        return new DownloadEngineBrowser(engine, allOptions);
    }
    static _validateOptions(options) {
        super._validateOptions(options);
        DownloadEngineBrowser._validateURL(options);
    }
}
//# sourceMappingURL=download-engine-browser.js.map