export default class SmartChunkSplit {
    _callback;
    _options;
    _bytesWriteLocation;
    _bytesLeftovers = 0;
    _chunks = [];
    constructor(_callback, _options) {
        this._options = _options;
        this._callback = _callback;
        this._bytesWriteLocation = _options.startChunk * _options.chunkSize;
    }
    addChunk(data) {
        this._chunks.push(data);
        this._sendChunk();
    }
    get savedLength() {
        return this._bytesLeftovers + this._chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    }
    sendLeftovers() {
        if (this.savedLength > 0) {
            this._callback(this._chunks, this._bytesWriteLocation, this._options.startChunk++);
        }
    }
    _sendChunk() {
        while (this.savedLength >= this._options.chunkSize) {
            if (this._chunks.length === 0) {
                this._callback([], this._bytesWriteLocation, this._options.startChunk++);
                this._bytesWriteLocation += this._options.chunkSize;
                this._bytesLeftovers -= this._options.chunkSize;
            }
            let sendLength = this._bytesLeftovers;
            for (let i = 0; i < this._chunks.length; i++) {
                sendLength += this._chunks[i].byteLength;
                if (sendLength >= this._options.chunkSize) {
                    const sendChunks = this._chunks.splice(0, i + 1);
                    this._callback(sendChunks, this._bytesWriteLocation, this._options.startChunk++);
                    this._bytesWriteLocation += sendLength - this._bytesLeftovers;
                    this._bytesLeftovers = sendLength - this._options.chunkSize;
                    break;
                }
            }
        }
    }
}
//# sourceMappingURL=smart-chunk-split.js.map