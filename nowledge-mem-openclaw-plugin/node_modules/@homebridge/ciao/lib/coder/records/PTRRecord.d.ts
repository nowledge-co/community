import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
export declare class PTRRecord extends ResourceRecord {
    static readonly DEFAULT_TTL = 4500;
    readonly ptrName: string;
    private lowerCasedPtrName?;
    constructor(name: string, ptrName: string, flushFlag?: boolean, ttl?: number);
    constructor(header: RecordRepresentation, ptrName: string);
    getLowerCasedPTRName(): string;
    protected getRDataEncodingLength(coder: DNSLabelCoder): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<PTRRecord>;
    clone(): PTRRecord;
    dataAsString(): string;
    dataEquals(record: PTRRecord): boolean;
}
//# sourceMappingURL=PTRRecord.d.ts.map