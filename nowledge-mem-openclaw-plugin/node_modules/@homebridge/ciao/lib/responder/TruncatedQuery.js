"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TruncatedQuery = exports.TruncatedQueryEvent = exports.TruncatedQueryResult = void 0;
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
const events_1 = require("events");
var TruncatedQueryResult;
(function (TruncatedQueryResult) {
    TruncatedQueryResult[TruncatedQueryResult["ABORT"] = 1] = "ABORT";
    TruncatedQueryResult[TruncatedQueryResult["AGAIN_TRUNCATED"] = 2] = "AGAIN_TRUNCATED";
    TruncatedQueryResult[TruncatedQueryResult["FINISHED"] = 3] = "FINISHED";
})(TruncatedQueryResult || (exports.TruncatedQueryResult = TruncatedQueryResult = {}));
var TruncatedQueryEvent;
(function (TruncatedQueryEvent) {
    TruncatedQueryEvent["TIMEOUT"] = "timeout";
})(TruncatedQueryEvent || (exports.TruncatedQueryEvent = TruncatedQueryEvent = {}));
class TruncatedQuery extends events_1.EventEmitter {
    constructor(packet) {
        super();
        this.arrivedPackets = 1; // just for the stats
        this.timeOfArrival = new Date().getTime();
        this.packet = packet;
        this.timer = this.resetTimer();
    }
    getPacket() {
        return this.packet;
    }
    getArrivedPacketCount() {
        return this.arrivedPackets;
    }
    getTotalWaitTime() {
        return new Date().getTime() - this.timeOfArrival;
    }
    appendDNSPacket(packet) {
        this.packet.combineWith(packet);
        this.arrivedPackets++;
        if (packet.flags.truncation) { // if the appended packet is again truncated, restart the timeout
            const time = new Date().getTime();
            if (time - this.timeOfArrival > 5 * 1000) { // if the first packet, is more than 5 seconds old, we abort
                return 1 /* TruncatedQueryResult.ABORT */;
            }
            this.resetTimer();
            return 2 /* TruncatedQueryResult.AGAIN_TRUNCATED */;
        }
        else {
            clearTimeout(this.timer);
            this.removeAllListeners();
            return 3 /* TruncatedQueryResult.FINISHED */;
        }
    }
    resetTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
        }
        // timeout in time interval between 400-500ms
        return this.timer = setTimeout(this.timeout.bind(this), 400 + Math.random() * 100);
    }
    timeout() {
        this.emit("timeout" /* TruncatedQueryEvent.TIMEOUT */);
        this.removeAllListeners();
    }
}
exports.TruncatedQuery = TruncatedQuery;
//# sourceMappingURL=TruncatedQuery.js.map