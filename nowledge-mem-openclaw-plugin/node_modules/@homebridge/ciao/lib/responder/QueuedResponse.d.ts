import { DNSPacket } from "../coder/DNSPacket";
import { InterfaceName } from "../NetworkManager";
import { QueryResponse } from "./QueryResponse";
/**
 * Represents a delay response packet which is going to be sent over multicast.
 */
export declare class QueuedResponse {
    static readonly MAX_DELAY = 500;
    private readonly packet;
    private readonly interfaceName;
    private timeOfCreation;
    estimatedTimeToBeSent: number;
    private delay;
    private timer?;
    delayed?: boolean;
    constructor(packet: DNSPacket, interfaceName: InterfaceName);
    getPacket(): DNSPacket;
    /**
     * This method returns the total delay of the represented dns response packet.
     * If this QueuedResponse consists of already combined packets
     * (meaning other packets already got delayed in order to be sent out with this packet),
     * the totalDelay will represent the maximum delay of any contained packet.
     *
     * @returns The total delay.
     */
    getTimeSinceCreation(): number;
    getTimeTillSent(): number;
    calculateRandomDelay(): void;
    scheduleResponse(callback: () => void): void;
    delayWouldBeInTimelyManner(next: QueuedResponse): boolean;
    /**
     * Combines this queue response packet with the {@code next} queued response packet if those can be combined.
     * Packets can be combined if the udpPayloadSize allows for it AND if the current packet
     * won't be delayed more than 500 ms from its time of creation AND the packets get sent on the same interface.
     *
     * @param next - A queued response which is schedule AFTER the current queued response.
     * @returns {@code true} will be returned if the queued response was combined with the specified {@code next} response.
     */
    combineWithNextPacketIfPossible(next: QueuedResponse): boolean;
    combineWithUniqueResponseIfPossible(response: QueryResponse, interfaceName: string): boolean;
}
//# sourceMappingURL=QueuedResponse.d.ts.map