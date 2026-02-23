"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DNSPacket = exports.PacketType = exports.QClass = exports.RClass = exports.QType = exports.RType = exports.RCode = exports.OpCode = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const fast_deep_equal_1 = tslib_1.__importDefault(require("fast-deep-equal"));
const dns_string_utils_1 = require("./dns-string-utils");
const DNSLabelCoder_1 = require("./DNSLabelCoder");
const Question_1 = require("./Question");
require("./records");
const ResourceRecord_1 = require("./ResourceRecord");
var OpCode;
(function (OpCode) {
    OpCode[OpCode["QUERY"] = 0] = "QUERY";
    // incomplete list
})(OpCode || (exports.OpCode = OpCode = {}));
var RCode;
(function (RCode) {
    RCode[RCode["NoError"] = 0] = "NoError";
    // incomplete list
})(RCode || (exports.RCode = RCode = {}));
var RType;
(function (RType) {
    RType[RType["A"] = 1] = "A";
    RType[RType["CNAME"] = 5] = "CNAME";
    RType[RType["PTR"] = 12] = "PTR";
    RType[RType["TXT"] = 16] = "TXT";
    RType[RType["AAAA"] = 28] = "AAAA";
    RType[RType["SRV"] = 33] = "SRV";
    RType[RType["OPT"] = 41] = "OPT";
    RType[RType["NSEC"] = 47] = "NSEC";
    // incomplete list
})(RType || (exports.RType = RType = {}));
var QType;
(function (QType) {
    QType[QType["A"] = 1] = "A";
    QType[QType["CNAME"] = 5] = "CNAME";
    QType[QType["PTR"] = 12] = "PTR";
    QType[QType["TXT"] = 16] = "TXT";
    QType[QType["AAAA"] = 28] = "AAAA";
    QType[QType["SRV"] = 33] = "SRV";
    // OPT = 41, // RFC 6891
    QType[QType["NSEC"] = 47] = "NSEC";
    QType[QType["ANY"] = 255] = "ANY";
    // incomplete list
})(QType || (exports.QType = QType = {}));
var RClass;
(function (RClass) {
    RClass[RClass["IN"] = 1] = "IN";
    // incomplete list
})(RClass || (exports.RClass = RClass = {}));
var QClass;
(function (QClass) {
    QClass[QClass["IN"] = 1] = "IN";
    QClass[QClass["ANY"] = 255] = "ANY";
    // incomplete list
})(QClass || (exports.QClass = QClass = {}));
var PacketType;
(function (PacketType) {
    PacketType[PacketType["QUERY"] = 0] = "QUERY";
    PacketType[PacketType["RESPONSE"] = 1] = "RESPONSE";
})(PacketType || (exports.PacketType = PacketType = {}));
function isQuery(query) {
    return "answers" in query;
}
function isProbeQuery(query) {
    return "authorities" in query;
}
class DNSPacket {
    constructor(definition) {
        this.questions = new Map();
        this.answers = new Map();
        this.authorities = new Map();
        this.additionals = new Map();
        this.estimatedEncodingLength = 0; // upper bound for the resulting encoding length, should only be called via the getter
        this.lastCalculatedLength = 0;
        this.lengthDirty = true;
        this.id = definition.id || 0;
        this.legacyUnicastEncoding = definition.legacyUnicast || false;
        this.type = definition.type;
        this.opcode = definition.opcode || 0 /* OpCode.QUERY */;
        this.flags = definition.flags || {};
        this.rcode = definition.rCode || 0 /* RCode.NoError */;
        if (this.type === 1 /* PacketType.RESPONSE */) {
            this.flags.authoritativeAnswer = true; // RFC 6763 18.4 AA is always set for responses in mdns
        }
        if (definition.questions) {
            this.addQuestions(...definition.questions);
        }
        if (definition.answers) {
            this.addAnswers(...definition.answers);
        }
        if (definition.authorities) {
            this.addAuthorities(...definition.authorities);
        }
        if (definition.additionals) {
            this.addAdditionals(...definition.additionals);
        }
    }
    static createDNSQueryPacket(definition, udpPayloadSize = this.UDP_PAYLOAD_SIZE_IPV4) {
        const packets = this.createDNSQueryPackets(definition, udpPayloadSize);
        (0, assert_1.default)(packets.length === 1, "Cannot user short method createDNSQueryPacket when query packets are more than one: is " + packets.length);
        return packets[0];
    }
    static createDNSQueryPackets(definition, udpPayloadSize = this.UDP_PAYLOAD_SIZE_IPV4) {
        const packets = [];
        // packet is like the "main" packet
        const packet = new DNSPacket({
            type: 0 /* PacketType.QUERY */,
            questions: definition.questions,
            additionals: isQuery(definition) ? definition.additionals : undefined, // OPT record is included in additionals section
        });
        packets.push(packet);
        if (packet.getEstimatedEncodingLength() > udpPayloadSize) {
            const compressedLength = packet.getEncodingLength(); // calculating the real length will update the estimated property as well
            if (compressedLength > udpPayloadSize) {
                // if we are still above the payload size we have a problem
                assert_1.default.fail("Cannot send query where already the query section is exceeding the udpPayloadSize (" + compressedLength + ">" + udpPayloadSize + ")!");
            }
        }
        // related https://en.wikipedia.org/wiki/Knapsack_problem
        if (isQuery(definition) && definition.answers) {
            let currentPacket = packet;
            let i = 0;
            const answers = definition.answers.concat([]); // concat basically creates a copy of the array
            // sort the answers ascending on their encoding length; otherwise we would need to check if a packets fits in a previously created packet
            answers.sort((a, b) => {
                return a.getEncodingLength(DNSLabelCoder_1.NonCompressionLabelCoder.INSTANCE) - b.getEncodingLength(DNSLabelCoder_1.NonCompressionLabelCoder.INSTANCE);
            });
            // in the loop below, we check if we need to truncate the list of known-answers in the query
            while (i < answers.length) {
                for (; i < answers.length; i++) {
                    const answer = answers[i];
                    const estimatedSize = answer.getEncodingLength(DNSLabelCoder_1.NonCompressionLabelCoder.INSTANCE);
                    if (packet.getEstimatedEncodingLength() + estimatedSize <= udpPayloadSize) { // size check on estimated calculations
                        currentPacket.addAnswers(answer);
                    }
                    else if (packet.getEncodingLength() + estimatedSize <= udpPayloadSize) { // check if the record may fit when message compression is used.
                        // we may still have a false positive here, as they currently can't compute the REAL encoding for the answer
                        // record, thus we rely on the estimated size
                        currentPacket.addAnswers(answer);
                    }
                    else {
                        if (currentPacket.questions.size === 0 && currentPacket.answers.size === 0) {
                            // we encountered a record which is too big and can't fit in a udpPayloadSize sized packet
                            // RFC 6762 17. In the case of a single Multicast DNS resource record that is too
                            //    large to fit in a single MTU-sized multicast response packet, a
                            //    Multicast DNS responder SHOULD send the resource record alone, in a
                            //    single IP datagram, using multiple IP fragments.
                            packet.addAnswers(answer);
                        }
                        break;
                    }
                }
                if (i < answers.length) { // if there are more records left, we need to truncate the packet again
                    currentPacket.flags.truncation = true; // first of all, mark the previous packet as truncated
                    currentPacket = new DNSPacket({ type: 0 /* PacketType.QUERY */ });
                    packets.push(currentPacket);
                }
            }
        }
        else if (isProbeQuery(definition) && definition.authorities) {
            packet.addAuthorities(...definition.authorities);
            const compressedLength = packet.getEncodingLength();
            if (compressedLength > udpPayloadSize) {
                assert_1.default.fail(`Probe query packet exceeds the mtu size (${compressedLength}>${udpPayloadSize}). Can't split probe queries at the moment!`);
            }
        } // otherwise, the packet consist of only questions
        return packets;
    }
    static createDNSResponsePacketsFromRRSet(definition, udpPayloadSize = this.UDP_PAYLOAD_SIZE_IPV4) {
        const packet = new DNSPacket({
            id: definition.id,
            legacyUnicast: definition.legacyUnicast,
            type: 1 /* PacketType.RESPONSE */,
            flags: { authoritativeAnswer: true }, // RFC 6763 18.4 AA is always set for responses in mdns
            // possible questions sent back to an unicast querier (unicast dns contain only one question, so no size problem here)
            questions: definition.questions,
            answers: definition.answers,
            additionals: definition.additionals,
        });
        if (packet.getEncodingLength() > udpPayloadSize) {
            assert_1.default.fail("Couldn't construct a dns response packet from a rr set which fits in an udp payload sized packet!");
        }
        return packet;
    }
    canBeCombinedWith(packet, udpPayloadSize = DNSPacket.UDP_PAYLOAD_SIZE_IPV4) {
        // packet header must be identical
        return this.id === packet.id && this.type === packet.type
            && this.opcode === packet.opcode && (0, fast_deep_equal_1.default)(this.flags, packet.flags)
            && this.rcode === packet.rcode
            // and the data must fit into a udpPayloadSize sized packet
            && this.getEncodingLength() + packet.getEncodingLength() <= udpPayloadSize;
    }
    combineWith(packet) {
        this.setLegacyUnicastEncoding(this.legacyUnicastEncoding || packet.legacyUnicastEncoding);
        this.addRecords(this.questions, packet.questions.values());
        this.addRecords(this.answers, packet.answers.values(), this.additionals);
        this.addRecords(this.authorities, packet.authorities.values());
        this.addRecords(this.additionals, packet.additionals.values());
    }
    addQuestions(...questions) {
        return this.addRecords(this.questions, questions);
    }
    addAnswers(...answers) {
        return this.addRecords(this.answers, answers, this.additionals);
    }
    addAuthorities(...authorities) {
        return this.addRecords(this.authorities, authorities);
    }
    addAdditionals(...additionals) {
        return this.addRecords(this.additionals, additionals);
    }
    addRecords(recordList, added, removeFromWhenAdded) {
        let addedAny = false;
        for (const record of added) {
            if (recordList.has(record.asString())) {
                continue;
            }
            if (this.estimatedEncodingLength) {
                this.estimatedEncodingLength += record.getEncodingLength(DNSLabelCoder_1.NonCompressionLabelCoder.INSTANCE);
            }
            recordList.set(record.asString(), record);
            addedAny = true;
            this.lengthDirty = true;
            if (removeFromWhenAdded) {
                removeFromWhenAdded.delete(record.asString());
            }
        }
        return addedAny;
    }
    setLegacyUnicastEncoding(legacyUnicastEncoding) {
        if (this.legacyUnicastEncoding !== legacyUnicastEncoding) {
            this.lengthDirty = true; // above option changes length of SRV records
        }
        this.legacyUnicastEncoding = legacyUnicastEncoding;
    }
    legacyUnicastEncodingEnabled() {
        return this.legacyUnicastEncoding;
    }
    getEstimatedEncodingLength() {
        if (this.estimatedEncodingLength) {
            return this.estimatedEncodingLength;
        }
        const labelCoder = DNSLabelCoder_1.NonCompressionLabelCoder.INSTANCE;
        let length = DNSPacket.DNS_PACKET_HEADER_SIZE;
        for (const record of this.questions.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        for (const record of this.answers.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        for (const record of this.authorities.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        for (const record of this.additionals.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        this.estimatedEncodingLength = length;
        return length;
    }
    getEncodingLength(coder) {
        if (!this.lengthDirty) {
            return this.lastCalculatedLength;
        }
        const labelCoder = coder || new DNSLabelCoder_1.DNSLabelCoder(this.legacyUnicastEncoding);
        let length = DNSPacket.DNS_PACKET_HEADER_SIZE;
        for (const record of this.questions.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        for (const record of this.answers.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        for (const record of this.authorities.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        for (const record of this.additionals.values()) {
            length += record.getEncodingLength(labelCoder);
        }
        this.lengthDirty = false; // reset dirty flag
        this.lastCalculatedLength = length;
        this.estimatedEncodingLength = length;
        return length;
    }
    encode() {
        const labelCoder = new DNSLabelCoder_1.DNSLabelCoder(this.legacyUnicastEncoding);
        const length = this.getEncodingLength(labelCoder);
        const buffer = Buffer.allocUnsafe(length);
        labelCoder.initBuf(buffer);
        let offset = 0;
        buffer.writeUInt16BE(this.id, offset);
        offset += 2;
        let flags = (this.type << 15) | (this.opcode << 11) | this.rcode;
        if (this.flags.authoritativeAnswer) {
            flags |= DNSPacket.AUTHORITATIVE_ANSWER_MASK;
        }
        if (this.flags.truncation) {
            flags |= DNSPacket.TRUNCATION_MASK;
        }
        if (this.flags.recursionDesired) {
            flags |= DNSPacket.RECURSION_DESIRED_MASK;
        }
        if (this.flags.recursionAvailable) {
            flags |= DNSPacket.RECURSION_AVAILABLE_MASK;
        }
        if (this.flags.zero) {
            flags |= DNSPacket.ZERO_HEADER_MASK;
        }
        if (this.flags.authenticData) {
            flags |= DNSPacket.AUTHENTIC_DATA_MASK;
        }
        if (this.flags.checkingDisabled) {
            flags |= DNSPacket.CHECKING_DISABLED_MASK;
        }
        buffer.writeUInt16BE(flags, offset);
        offset += 2;
        buffer.writeUInt16BE(this.questions.size, offset);
        offset += 2;
        buffer.writeUInt16BE(this.answers.size, offset);
        offset += 2;
        buffer.writeUInt16BE(this.authorities.size, offset);
        offset += 2;
        buffer.writeUInt16BE(this.additionals.size, offset);
        offset += 2;
        for (const question of this.questions.values()) {
            const length = question.encode(labelCoder, buffer, offset);
            offset += length;
        }
        for (const record of this.answers.values()) {
            const length = record.encode(labelCoder, buffer, offset);
            offset += length;
        }
        for (const record of this.authorities.values()) {
            const length = record.encode(labelCoder, buffer, offset);
            offset += length;
        }
        for (const record of this.additionals.values()) {
            const length = record.encode(labelCoder, buffer, offset);
            offset += length;
        }
        (0, assert_1.default)(offset === buffer.length, "Bytes written didn't match the buffer size!");
        return buffer;
    }
    static decode(context, buffer, offset = 0) {
        const labelCoder = new DNSLabelCoder_1.DNSLabelCoder();
        labelCoder.initBuf(buffer);
        const id = buffer.readUInt16BE(offset);
        offset += 2;
        const flags = buffer.readUInt16BE(offset);
        offset += 2;
        const questionLength = buffer.readUInt16BE(offset);
        offset += 2;
        const answerLength = buffer.readUInt16BE(offset);
        offset += 2;
        const authoritiesLength = buffer.readUInt16BE(offset);
        offset += 2;
        const additionalsLength = buffer.readUInt16BE(offset);
        offset += 2;
        const questions = [];
        const answers = [];
        const authorities = [];
        const additionals = [];
        offset += DNSPacket.decodeList(context, labelCoder, buffer, offset, questionLength, Question_1.Question.decode.bind(Question_1.Question), questions);
        offset += DNSPacket.decodeList(context, labelCoder, buffer, offset, answerLength, ResourceRecord_1.ResourceRecord.decode.bind(ResourceRecord_1.ResourceRecord), answers);
        offset += DNSPacket.decodeList(context, labelCoder, buffer, offset, authoritiesLength, ResourceRecord_1.ResourceRecord.decode.bind(ResourceRecord_1.ResourceRecord), authorities);
        offset += DNSPacket.decodeList(context, labelCoder, buffer, offset, additionalsLength, ResourceRecord_1.ResourceRecord.decode.bind(ResourceRecord_1.ResourceRecord), additionals);
        (0, assert_1.default)(offset === buffer.length, "Didn't read the full buffer (offset=" + offset + ", length=" + buffer.length + ")");
        const qr = (flags >> 15);
        const opcode = ((flags >> 11) & 0xf);
        const rCode = (flags & 0xf);
        const packetFlags = {};
        if (flags & this.AUTHORITATIVE_ANSWER_MASK) {
            packetFlags.authoritativeAnswer = true;
        }
        if (flags & this.TRUNCATION_MASK) {
            packetFlags.truncation = true;
        }
        if (flags & this.RECURSION_DESIRED_MASK) {
            packetFlags.recursionDesired = true;
        }
        if (flags & this.RECURSION_AVAILABLE_MASK) {
            packetFlags.recursionAvailable = true;
        }
        if (flags & this.ZERO_HEADER_MASK) {
            packetFlags.zero = true;
        }
        if (flags & this.AUTHENTIC_DATA_MASK) {
            packetFlags.authenticData = true;
        }
        if (flags & this.CHECKING_DISABLED_MASK) {
            packetFlags.checkingDisabled = true;
        }
        return new DNSPacket({
            id: id,
            type: qr,
            opcode: opcode,
            rCode: rCode,
            flags: packetFlags,
            questions: questions,
            answers: answers,
            authorities: authorities,
            additionals: additionals,
        });
    }
    static decodeList(context, coder, buffer, offset, length, decoder, destination) {
        const oldOffset = offset;
        for (let i = 0; i < length; i++) {
            const decoded = decoder(context, coder, buffer, offset);
            offset += decoded.readBytes;
            if (decoded.data) { // if the rdata is not supported by us, or we encountered a parsing error, we ignore the record
                destination.push(decoded.data);
            }
        }
        return offset - oldOffset;
    }
    asLoggingString(udpPayloadSize) {
        let answerString = "";
        let additionalsString = "";
        for (const record of this.answers.values()) {
            if (answerString) {
                answerString += ",";
            }
            answerString += (0, dns_string_utils_1.dnsTypeToString)(record.type);
        }
        for (const record of this.additionals.values()) {
            if (additionalsString) {
                additionalsString += ",";
            }
            additionalsString += (0, dns_string_utils_1.dnsTypeToString)(record.type);
        }
        const optionsStrings = [];
        if (this.legacyUnicastEncodingEnabled()) {
            optionsStrings.push("U");
        }
        if (udpPayloadSize) {
            optionsStrings.push("UPS: " + udpPayloadSize);
        }
        const optionsString = optionsStrings.length !== 0 ? ` (${optionsStrings})` : "";
        return `[${answerString}] answers and [${additionalsString}] additionals with size ${this.getEncodingLength()}B${optionsString}`;
    }
}
exports.DNSPacket = DNSPacket;
DNSPacket.UDP_PAYLOAD_SIZE_IPV4 = (process.env.CIAO_UPS ? parseInt(process.env.CIAO_UPS) : 1440);
// noinspection JSUnusedGlobalSymbols
DNSPacket.UDP_PAYLOAD_SIZE_IPV6 = (process.env.CIAO_UPS ? parseInt(process.env.CIAO_UPS) : 1440);
DNSPacket.AUTHORITATIVE_ANSWER_MASK = 0x400;
DNSPacket.TRUNCATION_MASK = 0x200;
DNSPacket.RECURSION_DESIRED_MASK = 0x100;
DNSPacket.RECURSION_AVAILABLE_MASK = 0x80;
DNSPacket.ZERO_HEADER_MASK = 0x40;
DNSPacket.AUTHENTIC_DATA_MASK = 0x20;
DNSPacket.CHECKING_DISABLED_MASK = 0x10;
// 2 bytes ID, 2 bytes flags, 2 bytes question count, 2 bytes answer count, 2 bytes authorities count; 2 bytes additionals count
DNSPacket.DNS_PACKET_HEADER_SIZE = 12;
//# sourceMappingURL=DNSPacket.js.map