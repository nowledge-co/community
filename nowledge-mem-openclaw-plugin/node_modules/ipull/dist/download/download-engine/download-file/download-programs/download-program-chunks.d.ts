import { SaveProgressInfo } from "../../types.js";
import BaseDownloadProgram, { DownloadSlice, ProgramSlice } from "./base-download-program.js";
export default class DownloadProgramChunks extends BaseDownloadProgram {
    constructor(savedProgress: SaveProgressInfo, downloadSlice: DownloadSlice);
    protected _createOneSlice(): ProgramSlice | null;
}
