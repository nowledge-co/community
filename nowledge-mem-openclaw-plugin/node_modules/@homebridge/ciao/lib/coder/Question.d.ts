import { AddressInfo } from "net";
import { DNSLabelCoder } from "./DNSLabelCoder";
import { DecodedData, DNSRecord, QClass, QType } from "./DNSPacket";
export declare class Question implements DNSRecord {
    private static readonly QU_MASK;
    private static readonly NOT_QU_MASK;
    readonly name: string;
    private lowerCasedName?;
    readonly type: QType;
    readonly class: QClass;
    unicastResponseFlag: boolean;
    constructor(name: string, type: QType, unicastResponseFlag?: boolean, clazz?: QClass);
    getLowerCasedName(): string;
    getEncodingLength(coder: DNSLabelCoder): number;
    encode(coder: DNSLabelCoder, buffer: Buffer, offset: number): number;
    clone(): Question;
    asString(): string;
    static decode(context: AddressInfo, coder: DNSLabelCoder, buffer: Buffer, offset: number): DecodedData<Question>;
}
//# sourceMappingURL=Question.d.ts.map