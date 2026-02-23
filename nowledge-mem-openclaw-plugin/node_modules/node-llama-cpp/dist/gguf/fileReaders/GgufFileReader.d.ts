import { GgufReadOffset } from "../utils/GgufReadOffset.js";
import { Promisable } from "../../utils/transformPromisable.js";
export declare const valueTypeToBytesToRead: {
    readonly uint8: 1;
    readonly uint16: 2;
    readonly uint32: 4;
    readonly uint64: 8;
    readonly int8: 1;
    readonly int16: 2;
    readonly int32: 4;
    readonly int64: 8;
    readonly float32: 4;
    readonly float64: 8;
    readonly bool: 1;
};
export declare abstract class GgufFileReader {
    protected _buffer: Buffer<ArrayBuffer>;
    abstract readByteRange(offset: number | GgufReadOffset, length: number): Promisable<Buffer>;
    protected abstract ensureHasByteRange(offset: number | GgufReadOffset, length: number): Promisable<void>;
    readUint8(offset: number | GgufReadOffset): Promisable<number>;
    readUint16(offset: number | GgufReadOffset): Promisable<number>;
    readUint32(offset: number | GgufReadOffset): Promisable<number>;
    readUint64(offset: number | GgufReadOffset): Promisable<bigint>;
    readInt8(offset: number | GgufReadOffset): Promisable<number>;
    readInt16(offset: number | GgufReadOffset): Promisable<number>;
    readInt32(offset: number | GgufReadOffset): Promisable<number>;
    readInt64(offset: number | GgufReadOffset): Promisable<bigint>;
    readFloat32(offset: number | GgufReadOffset): Promisable<number>;
    readFloat64(offset: number | GgufReadOffset): Promisable<number>;
    readBool(offset: number | GgufReadOffset): Promisable<boolean>;
    readString(offset: number | GgufReadOffset): Promisable<string>;
    readStringWithLength(offset: number | GgufReadOffset, length: number): Promisable<string>;
    protected _addToBuffer(buffer: Buffer): void;
    private _withBufferRead;
    static castNumberIfSafe(value: bigint): number | bigint;
}
