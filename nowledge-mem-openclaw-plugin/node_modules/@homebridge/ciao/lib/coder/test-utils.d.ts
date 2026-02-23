import { DNSPacket } from "./DNSPacket";
import { Question } from "./Question";
import { ResourceRecord } from "./ResourceRecord";
export declare function runRecordEncodingTest(record: Question | ResourceRecord, legacyUnicast?: boolean): void;
export declare function runPacketEncodingTest(packet: DNSPacket): void;
//# sourceMappingURL=test-utils.d.ts.map