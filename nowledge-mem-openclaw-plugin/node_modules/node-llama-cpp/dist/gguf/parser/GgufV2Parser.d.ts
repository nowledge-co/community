import { GgufReadOffset } from "../utils/GgufReadOffset.js";
import { GgufValueType, GgufVersionParserOptions, GgufVersionParserResult, MetadataKeyValueRecord, MetadataValue } from "../types/GgufFileInfoTypes.js";
import { Promisable } from "../../utils/transformPromisable.js";
export declare class GgufV2Parser {
    private readonly _fileReader;
    private readonly _shouldReadTensorInfo;
    private readonly _ignoreKeys;
    private readonly _readOffset;
    private readonly _logWarnings;
    constructor({ fileReader, readTensorInfo, ignoreKeys, readOffset, logWarnings }: GgufVersionParserOptions);
    parse(): Promise<GgufVersionParserResult>;
    protected _readGgufValue(type: GgufValueType, offset: number | GgufReadOffset): Promisable<MetadataValue>;
    protected _readStringValue(offset: number | GgufReadOffset): Promisable<string>;
    protected _readRawHeader(readOffset: GgufReadOffset): Promise<{
        tensorCount: number | bigint;
        metadata: MetadataKeyValueRecord;
        headerSize: number;
    }>;
    private _readTensorInfo;
}
