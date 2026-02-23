import { GgufReadOffset } from "../utils/GgufReadOffset.js";
import { GgufFileReader } from "./GgufFileReader.js";
type GgufFsFileReaderOptions = {
    filePath: string;
    signal?: AbortSignal;
};
export declare class GgufFsFileReader extends GgufFileReader {
    readonly filePath: string;
    private readonly _signal?;
    constructor({ filePath, signal }: GgufFsFileReaderOptions);
    readByteRange(offset: number | GgufReadOffset, length: number): Buffer<ArrayBuffer> | Promise<Buffer<ArrayBuffer>>;
    protected ensureHasByteRange(offset: number | GgufReadOffset, length: number): Promise<void> | undefined;
    private _readToExpandBufferUpToOffset;
    private _readByteRange;
}
export {};
