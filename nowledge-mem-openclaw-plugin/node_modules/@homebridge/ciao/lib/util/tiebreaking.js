"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiebreakingResult = void 0;
exports.rrComparator = rrComparator;
exports.runTiebreaking = runTiebreaking;
function rrComparator(recordA, recordB) {
    if (recordA.class !== recordB.class) {
        return recordA.class - recordB.class;
    }
    if (recordA.type !== recordB.type) {
        return recordA.type - recordB.type;
    }
    // now follows a raw comparison of the binary data
    const aData = recordA.getRawData();
    const bData = recordB.getRawData();
    const maxLength = Math.max(aData.length, bData.length); // get the biggest length
    for (let i = 0; i < maxLength; i++) {
        if (i >= aData.length && i < bData.length) { // a ran out of data and b still holds data
            return -1;
        }
        else if (i >= bData.length && i < aData.length) { // b ran out of data and a still hold data
            return 1;
        }
        const aByte = aData.readUInt8(i);
        const bByte = bData.readUInt8(i);
        if (aByte !== bByte) {
            return aByte < bByte ? -1 : 1;
        }
    }
    // if we reach here we have a tie. both records represent the SAME data.
    return 0;
}
var TiebreakingResult;
(function (TiebreakingResult) {
    /**
     * The opponent is considered the winner
     */
    TiebreakingResult[TiebreakingResult["OPPONENT"] = -1] = "OPPONENT";
    /**
     * Both try to expose the exact same data
     */
    TiebreakingResult[TiebreakingResult["TIE"] = 0] = "TIE";
    /**
     * The host is considered the winner
     */
    TiebreakingResult[TiebreakingResult["HOST"] = 1] = "HOST";
})(TiebreakingResult || (exports.TiebreakingResult = TiebreakingResult = {}));
/**
 * Runs the tiebreaking algorithm to resolve the race condition of simultaneous probing.
 * The input sets MUST already be sorted.
 *
 * @param {ResourceRecord[]} host - sorted list of records the host wants to publish
 * @param {ResourceRecord[]} opponent - sorted list of records the opponent wants to publish
 * @returns the result {@see TiebreakingResult} of the tiebreaking algorithm
 */
function runTiebreaking(host, opponent) {
    const maxLength = Math.max(host.length, opponent.length);
    for (let i = 0; i < maxLength; i++) {
        if (i >= host.length && i < opponent.length) { // host runs out of records and opponent still has some
            return -1 /* TiebreakingResult.OPPONENT */; // opponent wins
        }
        else if (i >= opponent.length && i < host.length) { // opponent runs out of records and host still has some
            return 1 /* TiebreakingResult.HOST */; // host wins
        }
        const recordComparison = rrComparator(host[i], opponent[i]);
        if (recordComparison !== 0) {
            return recordComparison;
        }
    }
    return 0 /* TiebreakingResult.TIE */; // they expose the exact same data
}
//# sourceMappingURL=tiebreaking.js.map