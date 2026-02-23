import { GgufFileReader } from "../fileReaders/GgufFileReader.js";
import { GgufReadOffset } from "../utils/GgufReadOffset.js";
import { UnsupportedGgufValueTypeError } from "../errors/UnsupportedGgufValueTypeError.js";
import { GgufValueType } from "../types/GgufFileInfoTypes.js";
import { convertMetadataKeyValueRecordToNestedObject } from "../utils/convertMetadataKeyValueRecordToNestedObject.js";
import { promisableLoop, transformPromisable, transformPromisablesInOrder } from "../../utils/transformPromisable.js";
import { noDirectSubNestingGGufMetadataKeys } from "../consts.js";
const ggufDefaultAlignment = 32;
export class GgufV2Parser {
    _fileReader;
    _shouldReadTensorInfo;
    _ignoreKeys;
    _readOffset;
    _logWarnings;
    constructor({ fileReader, readTensorInfo = true, ignoreKeys = [], readOffset, logWarnings }) {
        this._fileReader = fileReader;
        this._shouldReadTensorInfo = readTensorInfo;
        this._ignoreKeys = ignoreKeys;
        this._readOffset = readOffset;
        this._logWarnings = logWarnings;
    }
    async parse() {
        const readOffset = this._readOffset;
        const initialOffset = readOffset.offset;
        const headerReadResultPromisable = this._readRawHeader(readOffset);
        const headerReadResult = headerReadResultPromisable instanceof Promise
            ? await headerReadResultPromisable
            : headerReadResultPromisable;
        const alignmentHeader = headerReadResult.metadata["general.alignment"];
        const ggufAlignment = (alignmentHeader != null &&
            (typeof alignmentHeader === "number" || typeof alignmentHeader === "bigint") &&
            Number.isFinite(Number(alignmentHeader)))
            ? Number(alignmentHeader)
            : ggufDefaultAlignment;
        const tensorReadResultPromisable = this._shouldReadTensorInfo
            ? await this._readTensorInfo(headerReadResult.tensorCount, readOffset, ggufAlignment)
            : null;
        const tensorReadResult = tensorReadResultPromisable instanceof Promise
            ? await tensorReadResultPromisable
            : tensorReadResultPromisable;
        const metadata = convertMetadataKeyValueRecordToNestedObject(headerReadResult.metadata, {
            logOverrideWarnings: this._logWarnings,
            ignoreKeys: this._ignoreKeys,
            noDirectSubNestingKeys: noDirectSubNestingGGufMetadataKeys
        });
        return {
            tensorCount: headerReadResult.tensorCount,
            metadata: metadata,
            tensorInfo: tensorReadResult?.tensorInfo,
            metadataSize: headerReadResult.headerSize + initialOffset,
            tensorInfoSize: tensorReadResult?.tensorInfoSize,
            tensorDataOffset: tensorReadResult?.tensorDataOffset
        };
    }
    _readGgufValue(type, offset) {
        const readOffset = GgufReadOffset.resolveReadOffset(offset);
        switch (type) {
            case GgufValueType.Uint8: return this._fileReader.readUint8(readOffset);
            case GgufValueType.Int8: return this._fileReader.readInt8(readOffset);
            case GgufValueType.Uint16: return this._fileReader.readUint16(readOffset);
            case GgufValueType.Int16: return this._fileReader.readInt16(readOffset);
            case GgufValueType.Uint32: return this._fileReader.readUint32(readOffset);
            case GgufValueType.Int32: return this._fileReader.readInt32(readOffset);
            case GgufValueType.Float32: return this._fileReader.readFloat32(readOffset);
            case GgufValueType.Bool: return this._fileReader.readBool(readOffset);
            case GgufValueType.String: return this._readStringValue(readOffset);
            case GgufValueType.Uint64: return this._fileReader.readUint64(readOffset);
            case GgufValueType.Int64: return this._fileReader.readInt64(readOffset);
            case GgufValueType.Float64: return this._fileReader.readFloat64(readOffset);
        }
        if (type === GgufValueType.Array) {
            return transformPromisablesInOrder([
                () => this._fileReader.readUint32(readOffset),
                () => this._fileReader.readUint64(readOffset)
            ], ([arrayType, arrayLength]) => {
                const arrayValues = [];
                let i = 0;
                return promisableLoop({
                    condition: () => i < arrayLength,
                    callback: () => {
                        return transformPromisable(this._readGgufValue(arrayType, readOffset), (value) => {
                            arrayValues.push(value);
                        });
                    },
                    afterthought: () => void i++,
                    returnValue: () => arrayValues
                });
            });
        }
        throw new UnsupportedGgufValueTypeError(type);
    }
    _readStringValue(offset) {
        return this._fileReader.readString(offset);
    }
    async _readRawHeader(readOffset) {
        const initialOffset = readOffset.offset;
        const tensorCountAndMetadataKVCountPromisable = transformPromisablesInOrder([
            () => this._fileReader.readUint64(readOffset),
            () => transformPromisable(this._fileReader.readUint64(readOffset), Number)
        ]);
        const [tensorCount, metadataKVCount] = tensorCountAndMetadataKVCountPromisable instanceof Promise
            ? await tensorCountAndMetadataKVCountPromisable
            : tensorCountAndMetadataKVCountPromisable;
        const metadata = {};
        let i = 0;
        return promisableLoop({
            condition: () => i < metadataKVCount,
            callback: () => {
                return transformPromisablesInOrder([
                    () => this._readStringValue(readOffset),
                    () => this._fileReader.readUint32(readOffset)
                ], ([keyResult, valueType]) => {
                    return transformPromisable(this._readGgufValue(valueType, readOffset), (value) => {
                        metadata[keyResult] = value;
                    });
                });
            },
            afterthought: () => void i++,
            returnValue: () => ({
                tensorCount: GgufFileReader.castNumberIfSafe(tensorCount),
                metadata: metadata,
                headerSize: readOffset.offset - initialOffset
            })
        });
    }
    _readTensorInfo(tensorCount, readOffset, ggufAlignment) {
        const initialOffset = readOffset.offset;
        const tensorInfo = [];
        let i = 0n;
        return promisableLoop({
            condition: () => i < BigInt(tensorCount),
            callback: () => {
                const dimensions = [];
                return transformPromisablesInOrder([
                    () => this._readStringValue(readOffset),
                    () => this._fileReader.readUint32(readOffset)
                ], ([name, dimensionsNumber]) => {
                    let d = 0;
                    return promisableLoop({
                        condition: () => d < dimensionsNumber,
                        callback: () => {
                            return transformPromisable(this._fileReader.readUint64(readOffset), (dimension) => {
                                dimensions.push(GgufFileReader.castNumberIfSafe(dimension));
                            });
                        },
                        afterthought: () => void d++,
                        returnValue: () => {
                            return transformPromisablesInOrder([
                                () => this._fileReader.readUint32(readOffset),
                                () => this._fileReader.readUint64(readOffset)
                            ], ([ggmlType, offset]) => {
                                tensorInfo.push({
                                    name,
                                    dimensions,
                                    ggmlType: ggmlType,
                                    offset: GgufFileReader.castNumberIfSafe(offset),
                                    fileOffset: 0, // will be set later
                                    filePart: 1 // will be updated later if needed
                                });
                            });
                        }
                    });
                });
            },
            afterthought: () => void i++,
            returnValue: () => {
                const fileTensorDataOffset = alignOffset(readOffset.offset, ggufAlignment);
                for (const tensor of tensorInfo)
                    tensor.fileOffset = typeof tensor.offset === "bigint"
                        ? BigInt(fileTensorDataOffset) + tensor.offset
                        : fileTensorDataOffset + tensor.offset;
                return {
                    tensorInfo,
                    tensorInfoSize: readOffset.offset - initialOffset,
                    tensorDataOffset: fileTensorDataOffset
                };
            }
        });
    }
}
function alignOffset(offset, alignment) {
    return offset + (alignment - (offset % alignment)) % alignment;
}
//# sourceMappingURL=GgufV2Parser.js.map