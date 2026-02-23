import BaseDownloadEngineWriteStream from "./base-download-engine-write-stream.js";
import WriterIsClosedError from "./errors/writer-is-closed-error.js";
import WriterNotDefineError from "./errors/writer-not-define-error.js";
export default class DownloadEngineWriteStreamBrowser extends BaseDownloadEngineWriteStream {
    _writer;
    options = {};
    _memory = new Uint8Array(0);
    _bytesWritten = 0;
    get writerClosed() {
        return this.options.file?.totalSize && this._bytesWritten === this.options.file.totalSize;
    }
    constructor(_writer, options = {}) {
        super();
        this.options = options;
        this._writer = _writer;
    }
    _ensureBuffer(length) {
        if (this._memory.length >= length) {
            return this._memory;
        }
        if (!this.options.file) {
            throw new WriterNotDefineError("Writer & file is not defined, please provide a writer or file");
        }
        const newSize = Math.max(length, this.options.file.totalSize);
        const newMemory = new Uint8Array(newSize);
        newMemory.set(this._memory);
        return this._memory = newMemory;
    }
    write(cursor, buffer) {
        if (this.writerClosed) {
            throw new WriterIsClosedError();
        }
        if (!this._writer) {
            this._ensureBuffer(cursor + buffer.byteLength)
                .set(buffer, cursor);
            this._bytesWritten += buffer.byteLength;
            return;
        }
        return this._writer(cursor, buffer, this.options);
    }
    get result() {
        return this._memory;
    }
    resultAsBlobURL() {
        const blob = new Blob([this._memory]);
        return URL.createObjectURL(blob);
    }
    resultAsText() {
        return new TextDecoder().decode(this._memory);
    }
}
//# sourceMappingURL=download-engine-write-stream-browser.js.map