"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NonCompressionLabelCoder = exports.DNSLabelCoder = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
class DNSLabelCoder {
    constructor(legacyUnicastEncoding) {
        this.trackedLengths = [];
        this.writtenNames = [];
        this.legacyUnicastEncoding = legacyUnicastEncoding || false;
    }
    initBuf(buffer) {
        this.buffer = buffer;
    }
    initRRLocation(recordOffset, rDataOffset, rDataLength) {
        this.startOfRR = recordOffset;
        this.startOfRData = rDataOffset;
        this.rDataLength = rDataLength;
    }
    clearRRLocation() {
        this.startOfRR = undefined;
        this.startOfRData = undefined;
        this.rDataLength = undefined;
    }
    getUncompressedNameLength(name) {
        if (name === ".") {
            return 1; // root label takes one zero byte
        }
        (0, assert_1.default)(name.endsWith("."), "Supplied illegal name which doesn't end with the root label!");
        let length = 0;
        const labels = name.split(".");
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (!label && i < labels.length - 1) {
                assert_1.default.fail("Label " + i + " in name '" + name + "' was empty");
            }
            length += DNSLabelCoder.getLabelLength(label);
        }
        return length;
    }
    getNameLength(name) {
        if (DNSLabelCoder.DISABLE_COMPRESSION) {
            return this.getUncompressedNameLength(name);
        }
        if (name === ".") {
            return 1; // root label takes one zero byte and is not compressible
        }
        (0, assert_1.default)(name.endsWith("."), "Supplied illegal name which doesn't end with the root label!");
        const labelLengths = name.split(".")
            .map(label => DNSLabelCoder.getLabelLength(label));
        const nameLength = {
            name: name,
            length: 0, // total length needed for encoding (with compression enabled)
            labelLengths: labelLengths,
        };
        let candidateSharingLongestSuffix = undefined;
        let longestSuffixLength = 0; // amount of labels which are identical
        // pointers MUST only point to PRIOR label locations
        for (let i = 0; i < this.trackedLengths.length; i++) {
            const element = this.trackedLengths[i];
            const suffixLength = DNSLabelCoder.computeLabelSuffixLength(element.name, name);
            // it is very important that this is an GREATER and not just a GREATER EQUAL!!!!
            // don't change anything unless you fully understand all implications (0, and big comment block below)
            if (suffixLength > longestSuffixLength) {
                candidateSharingLongestSuffix = element;
                longestSuffixLength = suffixLength;
            }
        }
        let length = 0;
        if (candidateSharingLongestSuffix) {
            // in theory, it is possible that the candidate has a pointer which "fromIndex" is smaller than
            // the "toIndex" we are pointing to below. This could result in that we point to a location which
            // never gets written into the buffer, thus we can't point to it.
            // But as we always start in order (with the first element in our array; see for loop above)
            // we will always find the label first, which such a theoretical candidate is also pointing at
            const pointingFromIndex = labelLengths.length - 1 - longestSuffixLength; // -1 as the empty root label is always included
            for (let i = 0; i < pointingFromIndex; i++) {
                length += labelLengths[i];
            }
            length += 2; // 2 byte for the pointer
        }
        else {
            for (let i = 0; i < labelLengths.length; i++) {
                length += labelLengths[i];
            }
        }
        nameLength.length = length;
        this.trackedLengths.push(nameLength);
        return nameLength.length;
    }
    encodeUncompressedName(name, offset) {
        if (!this.buffer) {
            assert_1.default.fail("Illegal state. Buffer not initialized!");
        }
        return DNSLabelCoder.encodeUncompressedName(name, this.buffer, offset);
    }
    static encodeUncompressedName(name, buffer, offset) {
        (0, assert_1.default)(name.endsWith("."), "Name does not end with the root label");
        const oldOffset = offset;
        const labels = name === "."
            ? [""]
            : name.split(".");
        for (let i = 0; i < labels.length; i++) {
            const label = labels[i];
            if (label === "") {
                (0, assert_1.default)(i === labels.length - 1, "Encountered root label being not at the end of the domain name");
                buffer.writeUInt8(0, offset++); // write a terminating zero
                break;
            }
            // write length byte followed by the label data
            const length = buffer.write(label, offset + 1);
            buffer.writeUInt8(length, offset);
            offset += length + 1;
        }
        return offset - oldOffset; // written bytes
    }
    encodeName(name, offset) {
        if (DNSLabelCoder.DISABLE_COMPRESSION) {
            return this.encodeUncompressedName(name, offset);
        }
        if (!this.buffer) {
            assert_1.default.fail("Illegal state. Buffer not initialized!");
        }
        if (name === ".") {
            this.buffer.writeUInt8(0, offset); // write a terminating zero
            return 1;
        }
        const oldOffset = offset;
        const labels = name.split(".");
        const writtenName = {
            name: name,
            writtenLabels: new Array(labels.length).fill(-1), // init with "-1" meaning unknown location
        };
        let candidateSharingLongestSuffix = undefined;
        let longestSuffixLength = 0; // amount of labels which are identical
        for (let i = 0; i < this.writtenNames.length; i++) {
            const element = this.writtenNames[i];
            const suffixLength = DNSLabelCoder.computeLabelSuffixLength(element.name, name);
            // it is very important that this is an GREATER and not just a GREATER EQUAL!!!!
            // don't change anything unless you fully understand all implications (0, and big comment block below)
            if (suffixLength > longestSuffixLength) {
                candidateSharingLongestSuffix = element;
                longestSuffixLength = suffixLength;
            }
        }
        if (candidateSharingLongestSuffix) {
            // in theory, it is possible that the candidate has a pointer which "fromIndex" is smaller than
            // the "toIndex" we are pointing to below. This could result in that we point to a location which
            // never gets written into the buffer, thus we can't point to it.
            // But as we always start in order (with the first element in our array; see for loop above)
            // we will always find the label first, which such a theoretical candidate is also pointing at
            const pointingFromIndex = labels.length - 1 - longestSuffixLength; // -1 as the empty root label is always included
            const pointingToIndex = candidateSharingLongestSuffix.writtenLabels.length - 1 - longestSuffixLength;
            for (let i = 0; i < pointingFromIndex; i++) {
                writtenName.writtenLabels[i] = offset;
                offset += DNSLabelCoder.writeLabel(labels[i], this.buffer, offset);
            }
            const pointerDestination = candidateSharingLongestSuffix.writtenLabels[pointingToIndex];
            (0, assert_1.default)(pointerDestination !== -1, "Label which was pointed at wasn't yet written to the buffer!");
            (0, assert_1.default)(pointerDestination <= DNSLabelCoder.NOT_POINTER_MASK, "Pointer exceeds to length of a maximum of 14 bits");
            (0, assert_1.default)(pointerDestination < offset, "Pointer can only point to a prior location");
            const pointer = DNSLabelCoder.POINTER_MASK | pointerDestination;
            this.buffer.writeUInt16BE(pointer, offset);
            offset += 2;
        }
        else {
            for (let i = 0; i < labels.length; i++) {
                writtenName.writtenLabels[i] = offset;
                offset += DNSLabelCoder.writeLabel(labels[i], this.buffer, offset);
            }
        }
        this.writtenNames.push(writtenName);
        return offset - oldOffset; // written bytes
    }
    decodeName(offset, resolvePointers = true) {
        if (!this.buffer) {
            assert_1.default.fail("Illegal state. Buffer not initialized!");
        }
        const oldOffset = offset;
        let name = "";
        for (;;) {
            const length = this.buffer.readUInt8(offset++);
            if (length === 0) { // zero byte to terminate the name
                name += ".";
                break; // root label marks end of name
            }
            const labelTypePattern = length & DNSLabelCoder.POINTER_MASK_ONE_BYTE;
            if (labelTypePattern) {
                if (labelTypePattern === DNSLabelCoder.POINTER_MASK_ONE_BYTE) {
                    // we got a pointer here
                    const pointer = this.buffer.readUInt16BE(offset - 1) & DNSLabelCoder.NOT_POINTER_MASK; // extract the offset
                    offset++; // increment for the second byte of the pointer
                    if (!resolvePointers) {
                        name += name ? ".~" : "~";
                        break;
                    }
                    // if we would allow pointers to a later location, we MUST ensure that we don't end up in an endless loop
                    (0, assert_1.default)(pointer < oldOffset, "Pointer at " + (offset - 2) + " MUST point to a prior location!");
                    name += (name ? "." : "") + this.decodeName(pointer).data; // recursively decode the rest of the name
                    break; // pointer marks end of name
                }
                else if (labelTypePattern === DNSLabelCoder.LOCAL_COMPRESSION_ONE_BYTE) {
                    let localPointer = this.buffer.readUInt16BE(offset - 1) & DNSLabelCoder.NOT_POINTER_MASK;
                    offset++; // increment for the second byte of the pointer;
                    if (!resolvePointers) {
                        name += name ? ".~" : "~";
                        break;
                    }
                    if (localPointer >= 0 && localPointer < 255) { // 255 is reserved
                        (0, assert_1.default)(this.startOfRR !== undefined, "Cannot decompress locally compressed name as record is not initialized!");
                        localPointer += this.startOfRR;
                        (0, assert_1.default)(localPointer < oldOffset, "LocalPointer <255 at " + (offset - 2) + " MUST point to a prior location!");
                        name += (name ? "." : "") + this.decodeName(localPointer).data; // recursively decode the rest of the name
                    }
                    else if (localPointer >= 256) {
                        (0, assert_1.default)(this.startOfRData !== undefined && this.rDataLength !== undefined, "Cannot decompress locally compressed name as record is not initialized!");
                        localPointer -= -256; // subtract the offset 256
                        localPointer += this.startOfRData;
                        (0, assert_1.default)(localPointer < oldOffset, "LocationPoint >265 at " + (offset + 2) + " MUST point to a prior location!");
                        name += (name ? "." : "") + this.decodeName(localPointer).data; // recursively decode the rest of the name
                    }
                    else {
                        assert_1.default.fail("Encountered unknown pointer range " + localPointer);
                    }
                    break; // pointer marks end of name
                }
                else if (labelTypePattern === DNSLabelCoder.EXTENDED_LABEL_TYPE_ONE_BYTE) {
                    const extendedLabelType = length & DNSLabelCoder.NOT_POINTER_MASK_ONE_BYTE;
                    assert_1.default.fail("Received extended label type " + extendedLabelType + " at " + (offset - 1));
                }
                else {
                    assert_1.default.fail("Encountered unknown pointer type: " + Buffer.from([labelTypePattern >> 6]).toString("hex") + " (with original byte " +
                        Buffer.from([length]).toString("hex") + ")");
                }
            }
            const label = this.buffer.toString("utf-8", offset, offset + length);
            offset += length;
            name += (name ? "." : "") + label;
        }
        return {
            data: name,
            readBytes: offset - oldOffset,
        };
    }
    static getLabelLength(label) {
        if (!label) { // empty label aka root label
            return 1; // root label takes one zero byte
        }
        else {
            const byteLength = Buffer.byteLength(label);
            (0, assert_1.default)(byteLength <= 63, "Label cannot be longer than 63 bytes (" + label + ")");
            return 1 + byteLength; // length byte + label data
        }
    }
    static writeLabel(label, buffer, offset) {
        if (!label) {
            buffer.writeUInt8(0, offset);
            return 1;
        }
        else {
            const length = buffer.write(label, offset + 1);
            buffer.writeUInt8(length, offset);
            return length + 1;
        }
    }
    static computeLabelSuffixLength(a, b) {
        (0, assert_1.default)(a.length !== 0 && b.length !== 0, "Encountered empty name when comparing suffixes!");
        const lastAIndex = a.length - 1;
        const lastBIndex = b.length - 1;
        let equalLabels = 0;
        let exitByBreak = false;
        // we start with i=1 as the last character will always be the root label terminator "."
        for (let i = 1; i <= lastAIndex && i <= lastBIndex; i++) {
            // we are comparing both strings backwards
            const aChar = a.charAt(lastAIndex - i);
            const bChar = b.charAt(lastBIndex - i);
            (0, assert_1.default)(!!aChar && !!bChar, "Seemingly encountered out of bounds trying to calculate suffixes");
            if (aChar !== bChar) {
                exitByBreak = true;
                break; // encountered the first character to differ
            }
            else if (aChar === ".") {
                // we reached the label terminator, thus we count up the labels which are equal
                equalLabels++;
            }
        }
        if (!exitByBreak) {
            equalLabels++; // accommodate for the top level label (fqdn doesn't start with a dot)
        }
        return equalLabels;
    }
}
exports.DNSLabelCoder = DNSLabelCoder;
DNSLabelCoder.DISABLE_COMPRESSION = false;
// RFC 1035 4.1.4. Message compression:
//  In order to reduce the size of messages, the domain system utilizes a
//   compression scheme which eliminates the repetition of domain names in a
//   message.  In this scheme, an entire domain name or a list of labels at
//   the end of a domain name is replaced with a pointer to a PRIOR occurrence
//   of the same name.
//
//  The compression scheme allows a domain name in a message to be
//  represented as either:
//    - a sequence of labels ending in a zero octet
//    - a pointer
//    - a sequence of labels ending with a pointer
// RFC 6762 name compression for rdata should be used in: NS, CNAME, PTR, DNAME, SOA, MX, AFSDB, RT, KX, RP, PX, SRV, NSEC
DNSLabelCoder.POINTER_MASK = 0xC000; // 2 bytes, starting with 11
DNSLabelCoder.POINTER_MASK_ONE_BYTE = 0xC0; // same deal as above, just on a 1 byte level
DNSLabelCoder.LOCAL_COMPRESSION_ONE_BYTE = 0x80; // "10" label type https://tools.ietf.org/html/draft-ietf-dnsind-local-compression-05#section-4
DNSLabelCoder.EXTENDED_LABEL_TYPE_ONE_BYTE = 0x40; // "01" edns extended label type https://tools.ietf.org/html/rfc6891#section-4.2
DNSLabelCoder.NOT_POINTER_MASK = 0x3FFF;
DNSLabelCoder.NOT_POINTER_MASK_ONE_BYTE = 0x3F;
class NonCompressionLabelCoder extends DNSLabelCoder {
    getNameLength(name) {
        return this.getUncompressedNameLength(name);
    }
    encodeName(name, offset) {
        return this.encodeUncompressedName(name, offset);
    }
}
exports.NonCompressionLabelCoder = NonCompressionLabelCoder;
NonCompressionLabelCoder.INSTANCE = new NonCompressionLabelCoder();
//# sourceMappingURL=DNSLabelCoder.js.map