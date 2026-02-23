import ProgressStatusFile, { DownloadFlags, DownloadStatus } from "./progress-status-file.js";
import { ChunkStatus } from "../types.js";
import { EventEmitter } from "eventemitter3";
import { withLock } from "lifecycle-utils";
import switchProgram from "./download-programs/switch-program.js";
import { pushComment } from "./utils/push-comment.js";
const DEFAULT_OPTIONS = {
    chunkSize: 1024 * 1024 * 5,
    parallelStreams: 1
};
export default class DownloadEngineFile extends EventEmitter {
    file;
    options;
    _progress = {
        part: 0,
        chunks: [],
        chunkSize: 0,
        parallelStreams: 0
    };
    _closed = false;
    _progressStatus;
    _activeStreamBytes = {};
    _activeProgram;
    _downloadStatus = DownloadStatus.NotStarted;
    _latestProgressDate = 0;
    constructor(file, options) {
        super();
        this.file = file;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this._progressStatus = new ProgressStatusFile(file.parts.length, file.localFileName, options.fetchStream.transferAction, this._createProgressFlags());
        this._initProgress();
    }
    _createProgressFlags() {
        const flags = [];
        if (this.options.skipExisting) {
            flags.push(DownloadFlags.Existing);
        }
        return flags;
    }
    get downloadSize() {
        return this.file.parts.reduce((acc, part) => acc + part.size, 0);
    }
    get fileName() {
        return this.file.localFileName;
    }
    get status() {
        return this._progressStatus.createStatus(this._progress.part + 1, this.transferredBytes, this.downloadSize, this._downloadStatus, this.options.comment);
    }
    get _activePart() {
        return this.file.parts[this._progress.part];
    }
    get _downloadedPartsSize() {
        return this.file.parts.slice(0, this._progress.part)
            .reduce((acc, part) => acc + part.size, 0);
    }
    get _activeDownloadedChunkSize() {
        return this._progress.chunks.filter(c => c === ChunkStatus.COMPLETE).length * this._progress.chunkSize;
    }
    get transferredBytes() {
        if (this._downloadStatus === DownloadStatus.Finished) {
            return this.downloadSize;
        }
        const streamingBytes = Object.values(this._activeStreamBytes)
            .reduce((acc, bytes) => acc + bytes, 0);
        const streamBytes = this._activeDownloadedChunkSize + streamingBytes;
        const streamBytesMin = Math.min(streamBytes, this._activePart.size || streamBytes);
        const allBytes = streamBytesMin + this._downloadedPartsSize;
        return Math.min(allBytes, this.downloadSize || allBytes);
    }
    _emptyChunksForPart(part) {
        const partInfo = this.file.parts[part];
        if (partInfo.size === 0) {
            return [ChunkStatus.NOT_STARTED];
        }
        const chunksCount = Math.ceil(partInfo.size / this.options.chunkSize);
        return new Array(chunksCount).fill(ChunkStatus.NOT_STARTED);
    }
    _initEventReloadStatus() {
        if (this._progress.part === this.file.parts.length - 1 && this._progress.chunks.every(c => c === ChunkStatus.COMPLETE)) {
            this._downloadStatus = DownloadStatus.Finished;
        }
    }
    _initProgress() {
        if (this.options.skipExisting) {
            this._progress.part = this.file.parts.length - 1;
            this._downloadStatus = DownloadStatus.Finished;
            this.options.comment = pushComment("Skipping existing", this.options.comment);
        }
        else if (this.file.downloadProgress) {
            this._progress = this.file.downloadProgress;
            this._initEventReloadStatus();
        }
        else {
            this._progress = {
                part: 0,
                chunks: this._emptyChunksForPart(0),
                chunkSize: this.options.chunkSize,
                parallelStreams: this.options.parallelStreams
            };
        }
    }
    async download() {
        if (this._downloadStatus === DownloadStatus.NotStarted) {
            this._downloadStatus = DownloadStatus.Active;
        }
        this._progressStatus.started();
        this.emit("start");
        await this.options.onStartedAsync?.();
        for (let i = this._progress.part; i < this.file.parts.length && this._downloadStatus !== DownloadStatus.Finished; i++) {
            if (this._closed)
                return;
            // If we are starting a new part, we need to reset the progress
            if (i > this._progress.part || !this._activePart.acceptRange) {
                this._progress.part = i;
                this._progress.chunkSize = this.options.chunkSize;
                this._progress.parallelStreams = this.options.parallelStreams;
                this._progress.chunks = this._emptyChunksForPart(i);
            }
            // Reset in progress chunks
            this._progress.chunks = this._progress.chunks.map(chunk => (chunk === ChunkStatus.COMPLETE ? ChunkStatus.COMPLETE : ChunkStatus.NOT_STARTED));
            // Reset active stream progress
            this._activeStreamBytes = {};
            if (this._activePart.acceptRange) {
                this._activeProgram = switchProgram(this._progress, this._downloadSlice.bind(this), this.options.fetchStream.programType || this.options.programType);
                await this._activeProgram.download();
            }
            else {
                const chunksToRead = this._activePart.size > 0 ? this._progress.chunks.length : Infinity;
                await this._downloadSlice(0, chunksToRead);
            }
        }
        // All parts are downloaded, we can clear the progress
        this._activeStreamBytes = {};
        this._latestProgressDate = 0;
        if (this._closed)
            return;
        this._progressStatus.finished();
        this._downloadStatus = DownloadStatus.Finished;
        this._sendProgressDownloadPart();
        this.emit("finished");
        await this.options.onFinishAsync?.();
    }
    _downloadSlice(startChunk, endChunk) {
        const fetchState = this.options.fetchStream.withSubState({
            chunkSize: this._progress.chunkSize,
            startChunk,
            endChunk,
            totalSize: this._activePart.size,
            url: this._activePart.downloadURL,
            rangeSupport: this._activePart.acceptRange,
            onProgress: (length) => {
                this._activeStreamBytes[startChunk] = length;
                this._sendProgressDownloadPart();
            }
        });
        const downloadedPartsSize = this._downloadedPartsSize;
        this._progress.chunks[startChunk] = ChunkStatus.IN_PROGRESS;
        return (async () => {
            const allWrites = new Set();
            let lastChunkSize = 0;
            await fetchState.fetchChunks((chunks, writePosition, index) => {
                if (this._closed || this._progress.chunks[index] != ChunkStatus.IN_PROGRESS) {
                    return;
                }
                for (const chunk of chunks) {
                    const writePromise = this.options.writeStream.write(downloadedPartsSize + writePosition, chunk);
                    writePosition += chunk.length;
                    if (writePromise) {
                        allWrites.add(writePromise);
                        writePromise.then(() => {
                            allWrites.delete(writePromise);
                        });
                    }
                }
                // if content length is 0, we do not know how many chunks we should have
                if (this._activePart.size === 0) {
                    this._progress.chunks.push(ChunkStatus.NOT_STARTED);
                }
                this._progress.chunks[index] = ChunkStatus.COMPLETE;
                lastChunkSize = chunks.reduce((last, current) => last + current.length, 0);
                delete this._activeStreamBytes[startChunk];
                void this._saveProgress();
                const nextChunk = this._progress.chunks[index + 1];
                const shouldReadNext = endChunk - index > 1; // grater than 1, meaning there is a next chunk
                if (shouldReadNext) {
                    if (nextChunk == null || nextChunk != ChunkStatus.NOT_STARTED) {
                        return fetchState.close();
                    }
                    this._progress.chunks[index + 1] = ChunkStatus.IN_PROGRESS;
                }
            });
            // On dynamic content length, we need to adjust the last chunk size
            if (this._activePart.size === 0) {
                this._activePart.size = this._activeDownloadedChunkSize - this.options.chunkSize + lastChunkSize;
                this._progress.chunks = this._progress.chunks.filter(c => c === ChunkStatus.COMPLETE);
            }
            delete this._activeStreamBytes[startChunk];
            await Promise.all(allWrites);
        })();
    }
    _saveProgress() {
        const thisProgress = this._latestProgressDate = Date.now();
        this._sendProgressDownloadPart();
        if (!this._activePart.acceptRange)
            return;
        this.emit("save", this._progress);
        return withLock(this, "_saveLock", async () => {
            if (thisProgress === this._latestProgressDate) {
                await this.options.onSaveProgressAsync?.(this._progress);
            }
        });
    }
    _sendProgressDownloadPart() {
        if (this._closed)
            return;
        this.emit("progress", this.status);
    }
    pause() {
        if (this.options.fetchStream.paused) {
            return;
        }
        this._downloadStatus = DownloadStatus.Paused;
        this.options.fetchStream.emit("paused");
        this.emit("paused");
        this._sendProgressDownloadPart();
    }
    resume() {
        if (!this.options.fetchStream.paused) {
            return;
        }
        this._downloadStatus = DownloadStatus.Active;
        this.options.fetchStream.emit("resumed");
        this.emit("resumed");
        this._sendProgressDownloadPart();
    }
    async close() {
        if (this._closed)
            return;
        if (this._downloadStatus !== DownloadStatus.Finished) {
            this._progressStatus.finished();
            this._downloadStatus = DownloadStatus.Cancelled;
            this._sendProgressDownloadPart();
        }
        this._closed = true;
        this._activeProgram?.abort();
        await this.options.onCloseAsync?.();
        await this.options.writeStream.close();
        await this.options.fetchStream.close();
        this.emit("closed");
    }
    finished(comment) {
        if (comment) {
            this.options.comment = pushComment(comment, this.options.comment);
        }
        this._downloadStatus = DownloadStatus.Finished;
    }
    [Symbol.dispose]() {
        return this.close();
    }
}
//# sourceMappingURL=download-engine-file.js.map