"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runRecordEncodingTest = runRecordEncodingTest;
exports.runPacketEncodingTest = runPacketEncodingTest;
const DNSLabelCoder_1 = require("./DNSLabelCoder");
const DNSPacket_1 = require("./DNSPacket");
const Question_1 = require("./Question");
const ResourceRecord_1 = require("./ResourceRecord");
// Adjusted decodeContext to use the utility function for the address
const decodeContext = {
    address: "0.0.0.0",
    family: "ipv4",
    port: 5353,
};
function runRecordEncodingTest(record, legacyUnicast = false) {
    let coder = new DNSLabelCoder_1.DNSLabelCoder(legacyUnicast);
    const length = record.getEncodingLength(coder);
    const buffer = Buffer.alloc(length);
    coder.initBuf(buffer);
    const written = record.encode(coder, buffer, 0);
    expect(written).toBe(buffer.length);
    coder = new DNSLabelCoder_1.DNSLabelCoder(legacyUnicast);
    coder.initBuf(buffer);
    // test the decodeRecord method
    const decodedRecord = record instanceof Question_1.Question
        ? Question_1.Question.decode(decodeContext, coder, buffer, 0)
        : ResourceRecord_1.ResourceRecord.decode(decodeContext, coder, buffer, 0);
    expect(decodedRecord.readBytes).toBe(buffer.length);
    const record2 = decodedRecord.data;
    expect(record2).toBeDefined();
    coder = new DNSLabelCoder_1.DNSLabelCoder(legacyUnicast);
    const length2 = record2.getEncodingLength(coder);
    const buffer2 = Buffer.allocUnsafe(length2);
    coder.initBuf(buffer2);
    const written2 = record2.encode(coder, buffer2, 0);
    expect(written2).toBe(buffer2.length);
    expect(buffer2).toEqual(buffer);
    expect(record2).toEqual(record);
    if (record2 instanceof ResourceRecord_1.ResourceRecord && record instanceof ResourceRecord_1.ResourceRecord) {
        // test the equals method
        expect(record2.aboutEqual(record)).toBe(true);
        // test the clone method
        const clone = record.clone();
        expect(clone.aboutEqual(record2)).toBe(true);
        expect(clone).toEqual(record2);
    }
}
function runPacketEncodingTest(packet) {
    const buffer = packet.encode();
    const decodedPacket = DNSPacket_1.DNSPacket.decode(decodeContext, buffer);
    const buffer2 = decodedPacket.encode();
    expect(buffer).toEqual(buffer2);
    expect(decodedPacket).toEqual(packet);
}
//# sourceMappingURL=test-utils.js.map