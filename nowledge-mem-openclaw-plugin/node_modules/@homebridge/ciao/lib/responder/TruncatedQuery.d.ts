import { EventEmitter } from "events";
import { DNSPacket } from "../coder/DNSPacket";
export declare const enum TruncatedQueryResult {
    ABORT = 1,
    AGAIN_TRUNCATED = 2,
    FINISHED = 3
}
export declare const enum TruncatedQueryEvent {
    TIMEOUT = "timeout"
}
export declare interface TruncatedQuery {
    on(event: "timeout", listener: () => void): this;
    emit(event: "timeout"): boolean;
}
export declare class TruncatedQuery extends EventEmitter {
    private readonly timeOfArrival;
    private readonly packet;
    private arrivedPackets;
    private timer;
    constructor(packet: DNSPacket);
    getPacket(): DNSPacket;
    getArrivedPacketCount(): number;
    getTotalWaitTime(): number;
    appendDNSPacket(packet: DNSPacket): TruncatedQueryResult;
    private resetTimer;
    private timeout;
}
//# sourceMappingURL=TruncatedQuery.d.ts.map