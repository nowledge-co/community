import DownloadProgramChunks from "./download-program-chunks.js";
import DownloadProgramStream from "./download-program-stream.js";
export default function switchProgram(savedProgress, downloadSlice, name) {
    switch (name) {
        case "chunks":
            return new DownloadProgramChunks(savedProgress, downloadSlice);
        case "stream":
        default:
            return new DownloadProgramStream(savedProgress, downloadSlice);
    }
}
//# sourceMappingURL=switch-program.js.map