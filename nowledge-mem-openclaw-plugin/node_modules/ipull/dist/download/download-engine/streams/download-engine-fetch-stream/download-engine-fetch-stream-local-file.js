import fs from "fs/promises";
import { withLock } from "lifecycle-utils";
import retry from "async-retry";
import fsExtra from "fs-extra";
import BaseDownloadEngineFetchStream from "./base-download-engine-fetch-stream.js";
import SmartChunkSplit from "./utils/smart-chunk-split.js";
import streamResponse from "./utils/stream-response.js";
const OPEN_MODE = "r";
export default class DownloadEngineFetchStreamLocalFile extends BaseDownloadEngineFetchStream {
    transferAction = "Copying";
    _fd = null;
    _fsPath = null;
    withSubState(state) {
        const fetchStream = new DownloadEngineFetchStreamLocalFile(this.options);
        return this.cloneState(state, fetchStream);
    }
    async _ensureFileOpen(path) {
        return await withLock(this, "_lock", async () => {
            if (this._fd && this._fsPath === path) {
                return this._fd;
            }
            this._fd?.close();
            return await retry(async () => {
                await fsExtra.ensureFile(path);
                return this._fd = await fs.open(path, OPEN_MODE);
            }, this.options.retry);
        });
    }
    async fetchWithoutRetryChunks(callback) {
        const file = await this._ensureFileOpen(this.state.url);
        const stream = file.createReadStream({
            start: this._startSize,
            end: this._endSize - 1,
            autoClose: true
        });
        return await streamResponse(stream, this, new SmartChunkSplit(callback, this.state), this.state.onProgress);
    }
    async fetchDownloadInfoWithoutRetry(path) {
        const stat = await fs.stat(path);
        if (!stat.isFile()) {
            throw new Error("Path is a directory");
        }
        return {
            length: stat.size,
            acceptRange: true
        };
    }
    close() {
        super.close();
        this._fd?.close();
        this._fd = null;
    }
}
//# sourceMappingURL=download-engine-fetch-stream-local-file.js.map