import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
export interface OPTOption {
    code: number;
    data: Buffer;
}
export interface OPTFlags {
    dnsSecOK?: boolean;
    zero?: number;
}
export declare class OPTRecord extends ResourceRecord {
    private static readonly EDNS_VERSION;
    private static readonly DNS_SEC_OK_MASK;
    private static readonly NOT_DNS_SEC_OK_MASK;
    readonly udpPayloadSize: number;
    readonly extendedRCode: number;
    readonly ednsVersion: number;
    readonly flags: OPTFlags;
    readonly options: OPTOption[];
    constructor(udpPayloadSize: number, options?: OPTOption[], extendedRCode?: number, flags?: OPTFlags, ednsVersion?: number, ttl?: number);
    constructor(header: RecordRepresentation, options?: OPTOption[], extendedRCode?: number, flags?: OPTFlags, ednsVersion?: number, ttl?: number);
    protected getRDataEncodingLength(): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<OPTRecord>;
    clone(): ResourceRecord;
    dataAsString(): string;
    dataEquals(record: OPTRecord): boolean;
    private static optionsEquality;
}
//# sourceMappingURL=OPTRecord.d.ts.map