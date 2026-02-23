import { DecodedData } from "./DNSPacket";
export declare class DNSLabelCoder {
    static DISABLE_COMPRESSION: boolean;
    private static readonly POINTER_MASK;
    private static readonly POINTER_MASK_ONE_BYTE;
    private static readonly LOCAL_COMPRESSION_ONE_BYTE;
    private static readonly EXTENDED_LABEL_TYPE_ONE_BYTE;
    private static readonly NOT_POINTER_MASK;
    private static readonly NOT_POINTER_MASK_ONE_BYTE;
    private buffer?;
    readonly legacyUnicastEncoding: boolean;
    private startOfRR?;
    private startOfRData?;
    private rDataLength?;
    private readonly trackedLengths;
    private readonly writtenNames;
    constructor(legacyUnicastEncoding?: boolean);
    initBuf(buffer?: Buffer): void;
    initRRLocation(recordOffset: number, rDataOffset: number, rDataLength: number): void;
    clearRRLocation(): void;
    getUncompressedNameLength(name: string): number;
    getNameLength(name: string): number;
    encodeUncompressedName(name: string, offset: number): number;
    static encodeUncompressedName(name: string, buffer: Buffer, offset: number): number;
    encodeName(name: string, offset: number): number;
    decodeName(offset: number, resolvePointers?: boolean): DecodedData<string>;
    private static getLabelLength;
    private static writeLabel;
    private static computeLabelSuffixLength;
}
export declare class NonCompressionLabelCoder extends DNSLabelCoder {
    static readonly INSTANCE: NonCompressionLabelCoder;
    getNameLength(name: string): number;
    encodeName(name: string, offset: number): number;
}
//# sourceMappingURL=DNSLabelCoder.d.ts.map