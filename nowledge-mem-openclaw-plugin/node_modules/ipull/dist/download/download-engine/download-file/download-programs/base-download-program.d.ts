import { SaveProgressInfo } from "../../types.js";
export type ProgramSlice = {
    start: number;
    end: number;
};
export type DownloadSlice = (startChunk: number, endChunk: number) => Promise<void>;
export default abstract class BaseDownloadProgram {
    protected savedProgress: SaveProgressInfo;
    protected readonly _downloadSlice: DownloadSlice;
    protected _aborted: boolean;
    protected constructor(_savedProgress: SaveProgressInfo, _downloadSlice: DownloadSlice);
    download(): Promise<void>;
    protected abstract _createOneSlice(): ProgramSlice | null;
    abort(): void;
}
