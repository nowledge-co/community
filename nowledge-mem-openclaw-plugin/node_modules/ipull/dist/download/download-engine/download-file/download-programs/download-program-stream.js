import { ChunkStatus } from "../../types.js";
import BaseDownloadProgram from "./base-download-program.js";
export default class DownloadProgramStream extends BaseDownloadProgram {
    constructor(savedProgress, downloadSlice) {
        super(savedProgress, downloadSlice);
    }
    _createOneSlice() {
        const slice = this._findChunksSlices()[0];
        if (!slice)
            return null;
        const length = slice.end - slice.start;
        return { start: Math.floor(slice.start + length / 2), end: slice.end };
    }
    _findChunksSlices() {
        const chunksSlices = [];
        let start = 0;
        let currentIndex = 0;
        for (const chunk of this.savedProgress.chunks) {
            if (chunk !== ChunkStatus.NOT_STARTED) {
                if (start === currentIndex) {
                    start = ++currentIndex;
                    continue;
                }
                chunksSlices.push({ start, end: currentIndex });
                start = ++currentIndex;
                continue;
            }
            currentIndex++;
        }
        if (start !== currentIndex) {
            chunksSlices.push({ start, end: currentIndex });
        }
        return chunksSlices.sort((a, b) => (b.end - b.start) - (a.end - a.start));
    }
}
//# sourceMappingURL=download-program-stream.js.map