import { ChunkStatus } from "../../types.js";
import BaseDownloadProgram from "./base-download-program.js";
export default class DownloadProgramChunks extends BaseDownloadProgram {
    constructor(savedProgress, downloadSlice) {
        super(savedProgress, downloadSlice);
    }
    _createOneSlice() {
        const notDownloadedIndex = this.savedProgress.chunks.findIndex(c => c === ChunkStatus.NOT_STARTED);
        if (notDownloadedIndex === -1)
            return null;
        return { start: notDownloadedIndex, end: notDownloadedIndex + 1 };
    }
}
//# sourceMappingURL=download-program-chunks.js.map