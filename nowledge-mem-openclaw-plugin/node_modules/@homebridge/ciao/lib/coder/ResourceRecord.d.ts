import { AddressInfo } from "net";
import { DNSLabelCoder } from "./DNSLabelCoder";
import { DecodedData, DNSRecord, OptionalDecodedData, RClass, RType } from "./DNSPacket";
export interface RecordRepresentation {
    name: string;
    type: RType;
    class: RClass;
    ttl: number;
    flushFlag: boolean;
}
interface RecordHeaderData extends RecordRepresentation {
    rDataLength: number;
}
export type RRDecoder = (coder: DNSLabelCoder, header: RecordRepresentation, buffer: Buffer, offset: number) => DecodedData<ResourceRecord>;
export declare abstract class ResourceRecord implements DNSRecord {
    static readonly typeToRecordDecoder: Map<RType, RRDecoder>;
    private static readonly FLUSH_MASK;
    private static readonly NOT_FLUSH_MASK;
    static readonly RR_DEFAULT_TTL_SHORT = 120;
    static readonly RR_DEFAULT_TTL = 4500;
    readonly name: string;
    private lowerCasedName?;
    readonly type: RType;
    readonly class: RClass;
    ttl: number;
    flushFlag: boolean;
    protected constructor(headerData: RecordRepresentation);
    protected constructor(name: string, type: RType, ttl?: number, flushFlag?: boolean, clazz?: RClass);
    getLowerCasedName(): string;
    getEncodingLength(coder: DNSLabelCoder): number;
    encode(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    getRawData(): Buffer;
    protected abstract getRDataEncodingLength(coder: DNSLabelCoder): number;
    protected abstract encodeRData(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    abstract dataAsString(): string;
    abstract clone(): ResourceRecord;
    /**
     * Evaluates if the data section of the record is equal to the supplied record
     * @param record
     */
    abstract dataEquals(record: ResourceRecord): boolean;
    static clone<T extends ResourceRecord>(records: T[]): T[];
    protected getRecordRepresentation(): RecordRepresentation;
    /**
     * Returns if this and the supplied record are the same (ignoring ttl and flush flag)
     * @param record
     */
    aboutEqual(record: ResourceRecord): boolean;
    representsSameData(record: ResourceRecord): boolean;
    asString(): string;
    static decode(context: AddressInfo, coder: DNSLabelCoder, buffer: Buffer, offset: number): OptionalDecodedData<ResourceRecord>;
    protected static decodeRecordHeader(coder: DNSLabelCoder, buffer: Buffer, offset: number): DecodedData<RecordHeaderData>;
}
export {};
//# sourceMappingURL=ResourceRecord.d.ts.map