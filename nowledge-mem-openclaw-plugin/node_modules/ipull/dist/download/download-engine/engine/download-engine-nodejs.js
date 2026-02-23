import path from "path";
import DownloadEngineFile from "../download-file/download-engine-file.js";
import DownloadEngineFetchStreamFetch from "../streams/download-engine-fetch-stream/download-engine-fetch-stream-fetch.js";
import DownloadEngineWriteStreamNodejs from "../streams/download-engine-write-stream/download-engine-write-stream-nodejs.js";
import DownloadEngineFetchStreamLocalFile from "../streams/download-engine-fetch-stream/download-engine-fetch-stream-local-file.js";
import BaseDownloadEngine from "./base-download-engine.js";
import SavePathError from "./error/save-path-error.js";
import fs from "fs-extra";
import filenamify from "filenamify";
import { DownloadStatus } from "../download-file/progress-status-file.js";
export const PROGRESS_FILE_EXTENSION = ".ipull";
/**
 * Download engine for Node.js
 */
export default class DownloadEngineNodejs extends BaseDownloadEngine {
    options;
    constructor(engine, _options) {
        super(engine, _options);
        this.options = _options;
    }
    _initEvents() {
        super._initEvents();
        this._engine.options.onSaveProgressAsync = async (progress) => {
            if (this.options.skipExisting)
                return;
            await this.options.writeStream.saveMedataAfterFile(progress);
        };
        // Try to clone the file if it's a single part download
        this._engine.options.onStartedAsync = async () => {
            if (this.options.skipExisting || this.options.fetchStrategy !== "localFile" || this.options.partURLs.length !== 1)
                return;
            try {
                const { reflinkFile } = await import("@reflink/reflink");
                await fs.remove(this.options.writeStream.path);
                await reflinkFile(this.options.partURLs[0], this.options.writeStream.path);
                this._engine.finished("cloned");
            }
            catch { }
        };
        this._engine.options.onFinishAsync = async () => {
            if (this.options.skipExisting)
                return;
            await this.options.writeStream.ftruncate(this.downloadSize);
        };
        this._engine.options.onCloseAsync = async () => {
            if (this.status.ended && this.options.writeStream.path != this.options.writeStream.finalPath) {
                await fs.rename(this.options.writeStream.path, this.options.writeStream.finalPath);
                this.options.writeStream.path = this.options.writeStream.finalPath;
            }
        };
        if (this.options.skipExisting) {
            this.options.writeStream.path = this.options.writeStream.finalPath;
        }
    }
    /**
     * The file path with the progress extension or the final file path if the download is finished
     */
    get fileAbsolutePath() {
        return path.resolve(this.options.writeStream.path);
    }
    /**
     * The final file path (without the progress extension)
     */
    get finalFileAbsolutePath() {
        return path.resolve(this.options.writeStream.finalPath);
    }
    /**
     * Abort the download & delete the file (**even if** the download is finished)
     * @deprecated use `close` with flag `deleteFile` instead
     *
     * TODO: remove in the next major version
     */
    async closeAndDeleteFile() {
        await this.close({ deleteFile: true });
    }
    /**
     * Close the download engine
     * @param deleteTempFile {boolean} - delete the temp file (when the download is **not finished**).
     * @param deleteFile {boolean} - delete the **temp** or **final file** (clean everything up).
     */
    async close({ deleteTempFile, deleteFile } = {}) {
        await super.close();
        if (deleteFile || deleteTempFile && this.status.downloadStatus != DownloadStatus.Finished) {
            try {
                await fs.unlink(this.fileAbsolutePath);
            }
            catch { }
        }
    }
    /**
     * Download/copy a file
     *
     * if `fetchStrategy` is defined as "localFile" it will copy the file, otherwise it will download it
     * By default, it will guess the strategy based on the URL
     */
    static async createFromOptions(options) {
        DownloadEngineNodejs._validateOptions(options);
        const partURLs = "partURLs" in options ? options.partURLs : [options.url];
        options.fetchStrategy ??= DownloadEngineNodejs._guessFetchStrategy(partURLs[0]);
        const fetchStream = options.fetchStrategy === "localFile" ?
            new DownloadEngineFetchStreamLocalFile(options) :
            new DownloadEngineFetchStreamFetch(options);
        return DownloadEngineNodejs._createFromOptionsWithCustomFetch({ ...options, partURLs, fetchStream });
    }
    static async _createFromOptionsWithCustomFetch(options) {
        const downloadFile = await DownloadEngineNodejs._createDownloadFile(options.partURLs, options.fetchStream);
        const downloadLocation = DownloadEngineNodejs._createDownloadLocation(downloadFile, options);
        downloadFile.localFileName = path.basename(downloadLocation);
        const writeStream = new DownloadEngineWriteStreamNodejs(downloadLocation + PROGRESS_FILE_EXTENSION, downloadLocation, options);
        writeStream.fileSize = downloadFile.totalSize;
        downloadFile.downloadProgress = await writeStream.loadMetadataAfterFileWithoutRetry();
        if (options.skipExisting) {
            options.skipExisting = false;
            if (downloadFile.totalSize > 0 && !downloadFile.downloadProgress) {
                try {
                    const stat = await fs.stat(downloadLocation);
                    if (stat.isFile() && stat.size === downloadFile.totalSize) {
                        options.skipExisting = true;
                    }
                }
                catch { }
            }
        }
        const allOptions = { ...options, writeStream };
        const engine = new DownloadEngineFile(downloadFile, allOptions);
        return new DownloadEngineNodejs(engine, allOptions);
    }
    static _createDownloadLocation(download, options) {
        if ("savePath" in options) {
            return options.savePath;
        }
        const fileName = options.fileName || download.localFileName;
        return path.join(options.directory, filenamify(fileName));
    }
    static _validateOptions(options) {
        super._validateOptions(options);
        if (!("directory" in options) && !("savePath" in options)) {
            throw new SavePathError("Either `directory` or `savePath` must be provided");
        }
        if ("directory" in options && "savePath" in options) {
            throw new SavePathError("Both `directory` and `savePath` cannot be provided");
        }
        DownloadEngineNodejs._validateURL(options);
    }
    static _guessFetchStrategy(url) {
        try {
            new URL(url);
            return "fetch";
        }
        catch { }
        return "localFile";
    }
}
//# sourceMappingURL=download-engine-nodejs.js.map