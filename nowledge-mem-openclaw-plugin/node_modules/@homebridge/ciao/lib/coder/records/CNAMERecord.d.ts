import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
export declare class CNAMERecord extends ResourceRecord {
    static readonly DEFAULT_TTL = 4500;
    readonly cname: string;
    private lowerCasedCName?;
    constructor(name: string, cname: string, flushFlag?: boolean, ttl?: number);
    constructor(header: RecordRepresentation, cname: string);
    getLowerCasedCName(): string;
    protected getRDataEncodingLength(coder: DNSLabelCoder): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<CNAMERecord>;
    clone(): CNAMERecord;
    dataAsString(): string;
    dataEquals(record: CNAMERecord): boolean;
}
//# sourceMappingURL=CNAMERecord.d.ts.map