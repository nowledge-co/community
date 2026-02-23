import { DNSPacket } from "../coder/DNSPacket";
import { Question } from "../coder/Question";
import { ResourceRecord } from "../coder/ResourceRecord";
export type RecordAddMethod = (...records: ResourceRecord[]) => boolean;
export declare class QueryResponse {
    private readonly dnsPacket;
    readonly knownAnswers?: Map<string, ResourceRecord>;
    private sharedAnswer;
    constructor(knownAnswers?: Map<string, ResourceRecord>);
    asPacket(): DNSPacket;
    asString(udpPayloadSize?: number): string;
    containsSharedAnswer(): boolean;
    addAnswer(...records: ResourceRecord[]): boolean;
    addAdditional(...records: ResourceRecord[]): boolean;
    markLegacyUnicastResponse(id: number, questions?: Question[]): void;
    markTruncated(): void;
    hasAnswers(): boolean;
    private isKnownAnswer;
    static combineResponses(responses: QueryResponse[], udpPayloadSize?: number): void;
}
//# sourceMappingURL=QueryResponse.d.ts.map