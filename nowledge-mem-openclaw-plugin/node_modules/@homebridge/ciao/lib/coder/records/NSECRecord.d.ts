import { DNSLabelCoder } from "../DNSLabelCoder";
import { DecodedData, RType } from "../DNSPacket";
import { RecordRepresentation, ResourceRecord } from "../ResourceRecord";
interface RRTypeWindow {
    windowId: number;
    bitMapSize: number;
    rrtypes: RType[];
}
export declare class NSECRecord extends ResourceRecord {
    readonly nextDomainName: string;
    private lowerCasedNextDomainName?;
    readonly rrTypeWindows: RRTypeWindow[];
    constructor(name: string, nextDomainName: string, rrtypes: RType[], ttl: number, flushFlag?: boolean);
    constructor(header: RecordRepresentation, nextDomainName: string, rrtypes: RType[]);
    getLowerCasedNextDomainName(): string;
    private getRRTypesBitMapEncodingLength;
    protected getRDataEncodingLength(coder: DNSLabelCoder): number;
    protected encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    static decodeData(coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number): DecodedData<NSECRecord>;
    clone(): NSECRecord;
    dataAsString(): string;
    dataEquals(record: NSECRecord): boolean;
    private static rrTypesToWindowMap;
    private static windowsToRRTypes;
}
export {};
//# sourceMappingURL=NSECRecord.d.ts.map