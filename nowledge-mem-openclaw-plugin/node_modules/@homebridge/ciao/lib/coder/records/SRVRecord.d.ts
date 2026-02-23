import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
export declare class SRVRecord extends ResourceRecord {
    static readonly DEFAULT_TTL = 120;
    readonly hostname: string;
    private lowerCasedHostname?;
    readonly port: number;
    private readonly priority;
    private readonly weight;
    constructor(name: string, hostname: string, port: number, flushFlag?: boolean, ttl?: number);
    constructor(header: RecordRepresentation, hostname: string, port: number);
    getLowerCasedHostname(): string;
    protected getRDataEncodingLength(coder: DNSLabelCoder): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<SRVRecord>;
    clone(): SRVRecord;
    dataAsString(): string;
    dataEquals(record: SRVRecord): boolean;
}
//# sourceMappingURL=SRVRecord.d.ts.map