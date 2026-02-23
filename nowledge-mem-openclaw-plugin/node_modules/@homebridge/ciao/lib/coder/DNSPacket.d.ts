import { AddressInfo } from "net";
import { DNSLabelCoder } from "./DNSLabelCoder";
import { Question } from "./Question";
import "./records";
import { ResourceRecord } from "./ResourceRecord";
export declare const enum OpCode {
    QUERY = 0
}
export declare const enum RCode {
    NoError = 0
}
export declare const enum RType {
    A = 1,
    CNAME = 5,
    PTR = 12,
    TXT = 16,
    AAAA = 28,// RFC 3596 2.1.
    SRV = 33,// RFC 2782
    OPT = 41,// RFC 6891
    NSEC = 47
}
export declare const enum QType {
    A = 1,
    CNAME = 5,
    PTR = 12,
    TXT = 16,
    AAAA = 28,// RFC 3596 2.1.
    SRV = 33,// RFC 2782
    NSEC = 47,// RFC 4034 4.
    ANY = 255
}
export declare const enum RClass {
    IN = 1
}
export declare const enum QClass {
    IN = 1,// the internet
    ANY = 255
}
export declare const enum PacketType {
    QUERY = 0,
    RESPONSE = 1
}
export interface DecodedData<T> {
    data: T;
    readBytes: number;
}
export interface OptionalDecodedData<T> {
    data?: T;
    readBytes: number;
}
export interface DNSQueryDefinition {
    questions: Question[];
    answers?: ResourceRecord[];
    additionals?: ResourceRecord[];
}
export interface DNSProbeQueryDefinition {
    questions: Question[];
    authorities?: ResourceRecord[];
}
export interface DNSResponseDefinition {
    id?: number;
    questions?: Question[];
    answers: ResourceRecord[];
    additionals?: ResourceRecord[];
    legacyUnicast?: boolean;
}
export interface PacketFlags {
    authoritativeAnswer?: boolean;
    truncation?: boolean;
    recursionDesired?: boolean;
    recursionAvailable?: boolean;
    zero?: boolean;
    authenticData?: boolean;
    checkingDisabled?: boolean;
}
export interface PacketDefinition {
    id?: number;
    legacyUnicast?: boolean;
    type: PacketType;
    opcode?: OpCode;
    flags?: PacketFlags;
    rCode?: RCode;
    questions?: Question[];
    answers?: ResourceRecord[];
    authorities?: ResourceRecord[];
    additionals?: ResourceRecord[];
}
export interface DNSRecord {
    getEncodingLength(coder: DNSLabelCoder): number;
    encode(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    asString(): string;
}
export declare class DNSPacket {
    static readonly UDP_PAYLOAD_SIZE_IPV4: number;
    static readonly UDP_PAYLOAD_SIZE_IPV6: number;
    private static readonly AUTHORITATIVE_ANSWER_MASK;
    private static readonly TRUNCATION_MASK;
    private static readonly RECURSION_DESIRED_MASK;
    private static readonly RECURSION_AVAILABLE_MASK;
    private static readonly ZERO_HEADER_MASK;
    private static readonly AUTHENTIC_DATA_MASK;
    private static readonly CHECKING_DISABLED_MASK;
    private static readonly DNS_PACKET_HEADER_SIZE;
    id: number;
    private legacyUnicastEncoding;
    readonly type: PacketType;
    readonly opcode: OpCode;
    readonly flags: PacketFlags;
    readonly rcode: RCode;
    readonly questions: Map<string, Question>;
    readonly answers: Map<string, ResourceRecord>;
    readonly authorities: Map<string, ResourceRecord>;
    readonly additionals: Map<string, ResourceRecord>;
    private estimatedEncodingLength;
    private lastCalculatedLength;
    private lengthDirty;
    constructor(definition: PacketDefinition);
    static createDNSQueryPacket(definition: DNSQueryDefinition | DNSProbeQueryDefinition, udpPayloadSize?: number): DNSPacket;
    static createDNSQueryPackets(definition: DNSQueryDefinition | DNSProbeQueryDefinition, udpPayloadSize?: number): DNSPacket[];
    static createDNSResponsePacketsFromRRSet(definition: DNSResponseDefinition, udpPayloadSize?: number): DNSPacket;
    canBeCombinedWith(packet: DNSPacket, udpPayloadSize?: number): boolean;
    combineWith(packet: DNSPacket): void;
    addQuestions(...questions: Question[]): boolean;
    addAnswers(...answers: ResourceRecord[]): boolean;
    addAuthorities(...authorities: ResourceRecord[]): boolean;
    addAdditionals(...additionals: ResourceRecord[]): boolean;
    private addRecords;
    setLegacyUnicastEncoding(legacyUnicastEncoding: boolean): void;
    legacyUnicastEncodingEnabled(): boolean;
    private getEstimatedEncodingLength;
    private getEncodingLength;
    encode(): Buffer;
    static decode(context: AddressInfo, buffer: Buffer, offset?: number): DNSPacket;
    private static decodeList;
    asLoggingString(udpPayloadSize?: number): string;
}
//# sourceMappingURL=DNSPacket.d.ts.map