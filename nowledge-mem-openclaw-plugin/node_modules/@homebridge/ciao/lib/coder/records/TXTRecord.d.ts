import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
export declare class TXTRecord extends ResourceRecord {
    static readonly DEFAULT_TTL = 4500;
    readonly txt: Buffer[];
    constructor(name: string, txt: Buffer[], flushFlag?: boolean, ttl?: number);
    constructor(header: RecordRepresentation, txt: Buffer[]);
    protected getRDataEncodingLength(): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    clone(): TXTRecord;
    dataAsString(): string;
    dataEquals(record: TXTRecord): boolean;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<TXTRecord>;
}
//# sourceMappingURL=TXTRecord.d.ts.map