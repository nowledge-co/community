export default class BaseDownloadProgram {
    savedProgress;
    _downloadSlice;
    _aborted = false;
    constructor(_savedProgress, _downloadSlice) {
        this._downloadSlice = _downloadSlice;
        this.savedProgress = _savedProgress;
    }
    async download() {
        if (this.savedProgress.parallelStreams === 1) {
            return await this._downloadSlice(0, this.savedProgress.chunks.length);
        }
        const activeDownloads = [];
        // eslint-disable-next-line no-constant-condition
        while (true) {
            while (activeDownloads.length >= this.savedProgress.parallelStreams) {
                if (this._aborted)
                    return;
                await Promise.race(activeDownloads);
            }
            const slice = this._createOneSlice();
            if (slice == null)
                break;
            if (this._aborted)
                return;
            const promise = this._downloadSlice(slice.start, slice.end);
            activeDownloads.push(promise);
            promise.then(() => {
                activeDownloads.splice(activeDownloads.indexOf(promise), 1);
            });
        }
        await Promise.all(activeDownloads);
    }
    abort() {
        this._aborted = true;
    }
}
//# sourceMappingURL=base-download-program.js.map