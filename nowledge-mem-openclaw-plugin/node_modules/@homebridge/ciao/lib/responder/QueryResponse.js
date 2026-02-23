"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryResponse = void 0;
const DNSPacket_1 = require("../coder/DNSPacket");
class QueryResponse {
    constructor(knownAnswers) {
        this.sharedAnswer = false;
        this.dnsPacket = new DNSPacket_1.DNSPacket({ type: 1 /* PacketType.RESPONSE */ });
        this.knownAnswers = knownAnswers;
    }
    asPacket() {
        return this.dnsPacket;
    }
    asString(udpPayloadSize) {
        return this.dnsPacket.asLoggingString(udpPayloadSize);
    }
    containsSharedAnswer() {
        return this.sharedAnswer;
    }
    addAnswer(...records) {
        let addedAny = false;
        for (const record of records) {
            if (this.isKnownAnswer(record)) {
                // record is a known answer to the querier
                continue;
            }
            const added = this.dnsPacket.addAnswers(record);
            if (added) {
                addedAny = true;
                if (!record.flushFlag) {
                    this.sharedAnswer = true;
                }
            }
        }
        return addedAny;
    }
    addAdditional(...records) {
        let addedAny = false;
        for (const record of records) {
            if (this.isKnownAnswer(record)) {
                // check if the additional record is a known answer, otherwise there is no need to send it
                continue;
            }
            if (this.dnsPacket.answers.has(record.asString())) {
                continue; // if it is already in the answer section, don't include it in additionals
            }
            const added = this.dnsPacket.addAdditionals(record);
            if (added) {
                addedAny = true;
            }
        }
        return addedAny;
    }
    markLegacyUnicastResponse(id, questions) {
        // we are dealing with a legacy unicast dns query (RFC 6762 6.7.)
        //  * MUSTS: response via unicast, repeat query ID, repeat questions (actually it should just be one), clear cache flush bit
        //  * SHOULDS: ttls should not be greater than 10s as legacy resolvers don't take part in the cache coherency mechanism
        this.dnsPacket.id = id;
        if (questions) {
            this.dnsPacket.addQuestions(...questions);
        }
        this.dnsPacket.answers.forEach(answers => {
            answers.flushFlag = false;
            answers.ttl = 10;
        });
        this.dnsPacket.additionals.forEach(answers => {
            answers.flushFlag = false;
            answers.ttl = 10;
        });
        this.dnsPacket.setLegacyUnicastEncoding(true); // legacy unicast also affects the encoder (must not use compression for the SRV record) so we need to tell him
    }
    markTruncated() {
        this.dnsPacket.flags.truncation = true;
    }
    hasAnswers() {
        // we may still have additionals, though there is no reason when answers is empty
        // removeKnownAnswer may have removed all answers and only additionals are known.
        return this.dnsPacket.answers.size > 0;
    }
    isKnownAnswer(record) {
        if (!this.knownAnswers) {
            return false;
        }
        const knownAnswer = this.knownAnswers.get(record.asString());
        // we will still send the response if the known answer has half of the original ttl according to RFC 6762 7.1.
        // so only if the ttl is more than half than the original ttl we consider it a valid known answer
        return knownAnswer !== undefined && knownAnswer.ttl > record.ttl / 2;
    }
    static combineResponses(responses, udpPayloadSize) {
        for (let i = 0; i < responses.length - 1; i++) {
            const current = responses[i];
            const currentPacket = current.dnsPacket;
            const next = responses[i + 1];
            const nextPacket = next.dnsPacket;
            if (currentPacket.canBeCombinedWith(nextPacket, udpPayloadSize)) {
                // combine the packet with next one
                currentPacket.combineWith(nextPacket);
                // remove next from the array
                responses.splice(i + 1, 1);
                // we won't combine the known answer section, with current implementation they will always be the same
                current.sharedAnswer = current.sharedAnswer || next.sharedAnswer;
                // decrement i, so we check again if the "current" packet can be combined with the packet after "next"
                i--;
            }
        }
    }
}
exports.QueryResponse = QueryResponse;
//# sourceMappingURL=QueryResponse.js.map