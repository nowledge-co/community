"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuedResponse = void 0;
/**
 * Represents a delay response packet which is going to be sent over multicast.
 */
class QueuedResponse {
    constructor(packet, interfaceName) {
        this.timeOfCreation = new Date().getTime(); // epoch time millis
        this.estimatedTimeToBeSent = 0; // epoch time millis
        this.delay = -1;
        this.packet = packet;
        this.interfaceName = interfaceName;
    }
    getPacket() {
        return this.packet;
    }
    /**
     * This method returns the total delay of the represented dns response packet.
     * If this QueuedResponse consists of already combined packets
     * (meaning other packets already got delayed in order to be sent out with this packet),
     * the totalDelay will represent the maximum delay of any contained packet.
     *
     * @returns The total delay.
     */
    getTimeSinceCreation() {
        return new Date().getTime() - this.timeOfCreation;
    }
    getTimeTillSent() {
        return Math.max(0, this.estimatedTimeToBeSent - new Date().getTime());
    }
    calculateRandomDelay() {
        this.delay = Math.random() * 100 + 20; // delay of 20ms - 120ms
        this.estimatedTimeToBeSent = new Date().getTime() + this.delay;
    }
    scheduleResponse(callback) {
        this.timer = setTimeout(callback, this.delay);
        this.timer.unref(); // timer doesn't prevent termination
    }
    delayWouldBeInTimelyManner(next) {
        const delay = next.estimatedTimeToBeSent - this.timeOfCreation;
        return delay <= QueuedResponse.MAX_DELAY;
    }
    /**
     * Combines this queue response packet with the {@code next} queued response packet if those can be combined.
     * Packets can be combined if the udpPayloadSize allows for it AND if the current packet
     * won't be delayed more than 500 ms from its time of creation AND the packets get sent on the same interface.
     *
     * @param next - A queued response which is schedule AFTER the current queued response.
     * @returns {@code true} will be returned if the queued response was combined with the specified {@code next} response.
     */
    combineWithNextPacketIfPossible(next) {
        // below check, which is commented out would be necessary, current implementation will check that
        // with function above, thus there is no need to check again.
        /*
        if (!this.delayWouldBeInTimelyManner(next)) {
          return false;
        }
        */
        if (this.interfaceName !== next.interfaceName) {
            // can't combine packets which get sent via different interfaces
            return false;
        }
        if (!next.packet.canBeCombinedWith(this.packet)) {
            // packets can't be combined
            return false;
        }
        next.packet.combineWith(this.packet);
        next.timeOfCreation = Math.min(this.timeOfCreation, next.timeOfCreation);
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this.delayed = true;
        return true;
    }
    combineWithUniqueResponseIfPossible(response, interfaceName) {
        if (this.interfaceName !== interfaceName) {
            // can't combine packets which get sent via different interfaces
            return false;
        }
        if (!this.packet.canBeCombinedWith(response.asPacket())) {
            return false; // packets can't be combined
        }
        this.packet.combineWith(response.asPacket());
        return true;
    }
}
exports.QueuedResponse = QueuedResponse;
QueuedResponse.MAX_DELAY = 500; // milliseconds
//# sourceMappingURL=QueuedResponse.js.map