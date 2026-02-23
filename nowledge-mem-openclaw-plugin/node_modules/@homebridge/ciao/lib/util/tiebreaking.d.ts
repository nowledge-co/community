/**
 * Comparator for two ResourceRecords according to RFC 6762 8.2. "Simultaneous ProbeTiebreaking":
 *    The determination of "lexicographically later" is performed by first
 *    comparing the record class (excluding the cache-flush bit described
 *    in Section 10.2), then the record type, then raw comparison of the
 *    binary content of the rdata without regard for meaning or structure.
 *
 * @param recordA - record a
 * @param recordB - record b
 * @returns -1 if record a < record b, 0 if record a == record b, 1 if record a > record b
 */
import { ResourceRecord } from "../coder/ResourceRecord";
export declare function rrComparator(recordA: ResourceRecord, recordB: ResourceRecord): number;
export declare const enum TiebreakingResult {
    /**
     * The opponent is considered the winner
     */
    OPPONENT = -1,
    /**
     * Both try to expose the exact same data
     */
    TIE = 0,
    /**
     * The host is considered the winner
     */
    HOST = 1
}
/**
 * Runs the tiebreaking algorithm to resolve the race condition of simultaneous probing.
 * The input sets MUST already be sorted.
 *
 * @param {ResourceRecord[]} host - sorted list of records the host wants to publish
 * @param {ResourceRecord[]} opponent - sorted list of records the opponent wants to publish
 * @returns the result {@see TiebreakingResult} of the tiebreaking algorithm
 */
export declare function runTiebreaking(host: ResourceRecord[], opponent: ResourceRecord[]): TiebreakingResult;
//# sourceMappingURL=tiebreaking.d.ts.map