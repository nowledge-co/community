import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
export declare class AAAARecord extends ResourceRecord {
    static readonly DEFAULT_TTL = 120;
    readonly ipAddress: string;
    constructor(name: string, ipAddress: string, flushFlag?: boolean, ttl?: number);
    constructor(header: RecordRepresentation, ipAddress: string);
    protected getRDataEncodingLength(): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<AAAARecord>;
    clone(): AAAARecord;
    dataAsString(): string;
    dataEquals(record: AAAARecord): boolean;
}
//# sourceMappingURL=AAAARecord.d.ts.map