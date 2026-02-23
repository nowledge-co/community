"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NSECRecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const fast_deep_equal_1 = tslib_1.__importDefault(require("fast-deep-equal"));
const dns_equal_1 = require("../../util/dns-equal");
const ResourceRecord_1 = require("../ResourceRecord");
class NSECRecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, nextDomainName, rrtypes, ttl, flushFlag) {
        if (typeof name === "string") {
            super(name, 47 /* RType.NSEC */, ttl || NSECRecord.RR_DEFAULT_TTL_SHORT, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 47 /* RType.NSEC */);
            super(name);
        }
        if (!nextDomainName.endsWith(".")) {
            nextDomainName += ".";
        }
        this.nextDomainName = nextDomainName;
        this.rrTypeWindows = NSECRecord.rrTypesToWindowMap(rrtypes);
    }
    getLowerCasedNextDomainName() {
        return this.lowerCasedNextDomainName || (this.lowerCasedNextDomainName = (0, dns_equal_1.dnsLowerCase)(this.nextDomainName));
    }
    getRRTypesBitMapEncodingLength() {
        let rrTypesBitMapLength = 0;
        for (const window of this.rrTypeWindows) {
            (0, assert_1.default)(window.rrtypes.length > 0, "types array for windowId " + window.windowId + " cannot be empty!");
            rrTypesBitMapLength += 2 // 1 byte for windowId; 1 byte for bitmap length
                + window.bitMapSize;
        }
        return rrTypesBitMapLength;
    }
    getRDataEncodingLength(coder) {
        // RFC 4034 4.1.1. name compression MUST NOT be used for the nextDomainName, though RFC 6762 18.14 specifies it should
        return (coder.legacyUnicastEncoding
            ? coder.getUncompressedNameLength(this.nextDomainName)
            : coder.getUncompressedNameLength(this.nextDomainName)) // we skip compression for NSEC records for now, as Ubiquiti mdns forward can't handle that
            + this.getRRTypesBitMapEncodingLength();
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        const length = coder.legacyUnicastEncoding
            ? coder.encodeUncompressedName(this.nextDomainName, offset)
            : coder.encodeUncompressedName(this.nextDomainName, offset); // we skip compression for NSEC records for now, as Ubiquiti mdns forward can't handle that
        offset += length;
        // RFC 4034 4.1.2. type bit maps field has the following format ( Window Block # | Bitmap Length | Bitmap )+ (with | concatenation)
        // e.g. 0x00 0x01 0x40 => defines the window 0; bitmap length 1; and the bitmap 10000000, meaning the first bit is
        // set for the 0th window => rrTypes = [A]. The bitmap length depends on the rtype with the highest value for the
        // given value (max 32 bytes per bitmap)
        for (const window of this.rrTypeWindows) {
            buffer.writeUInt8(window.windowId, offset++);
            buffer.writeUInt8(window.bitMapSize, offset++);
            const bitmap = Buffer.alloc(window.bitMapSize);
            for (const type of window.rrtypes) {
                const byteNum = (type & 0xFF) >> 3; // basically floored division by 8
                let mask = bitmap.readUInt8(byteNum);
                mask |= 1 << (7 - (type & 0x7)); // OR with 1 shifted according to the lowest 3 bits
                bitmap.writeUInt8(mask, byteNum);
            }
            bitmap.copy(buffer, offset);
            offset += bitmap.length;
        }
        return offset - oldOffset;
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        /**
         * Quick note to the line below. We base "false" as the second argument to decodeName, telling
         * it to not resolve pointers.
         * We discovered that especially UniFi routers with a VLAN setup and mdns forwarding enabled,
         * fail to properly encode pointers inside the nextDomainName field.
         * Those pointers simply point to random points in the record data, resulting in decoding to fail.
         * As the field doesn't have any meaning, and we simply don't use it, we just skip decoding for now.
         */
        const decodedNextDomainName = coder.decodeName(offset, false);
        offset += decodedNextDomainName.readBytes;
        const rrTypes = [];
        while (offset < buffer.length) {
            const windowId = buffer.readUInt8(offset++);
            const bitMapLength = buffer.readUInt8(offset++);
            const upperRType = windowId << 8;
            for (let block = 0; block < bitMapLength; block++) {
                const byte = buffer.readUInt8(offset++);
                for (let bit = 0; bit < 8; bit++) { // iterate over every bit
                    if (byte & (1 << (7 - bit))) { // check if bit is set
                        const rType = upperRType | (block << 3) | bit; // OR upperWindowNum | basically block * 8 | bit number
                        rrTypes.push(rType);
                    }
                }
            }
        }
        return {
            data: new NSECRecord(header, decodedNextDomainName.data, rrTypes),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new NSECRecord(this.getRecordRepresentation(), this.nextDomainName, NSECRecord.windowsToRRTypes(this.rrTypeWindows));
    }
    dataAsString() {
        return `${this.nextDomainName} [${NSECRecord.windowsToRRTypes(this.rrTypeWindows).map(rtype => "" + rtype).join(",")}]`;
    }
    dataEquals(record) {
        return this.getLowerCasedNextDomainName() === record.getLowerCasedNextDomainName() && (0, fast_deep_equal_1.default)(this.rrTypeWindows, record.rrTypeWindows);
    }
    static rrTypesToWindowMap(rrtypes) {
        const rrTypeWindows = [];
        for (const rrtype of rrtypes) {
            const windowId = rrtype >> 8;
            let window = undefined;
            for (const window0 of rrTypeWindows) {
                if (window0.windowId === windowId) {
                    window = window0;
                    break;
                }
            }
            if (!window) {
                window = {
                    windowId: windowId,
                    bitMapSize: Math.ceil((rrtype & 0xFF) / 8),
                    rrtypes: [rrtype],
                };
                rrTypeWindows.push(window);
            }
            else {
                window.rrtypes.push(rrtype);
                const bitMapSize = Math.ceil((rrtype & 0xFF) / 8);
                if (bitMapSize > window.bitMapSize) {
                    window.bitMapSize = bitMapSize;
                }
            }
        }
        // sort by windowId
        rrTypeWindows.sort((a, b) => a.windowId - b.windowId);
        rrTypeWindows.forEach(window => window.rrtypes.sort((a, b) => a - b));
        return rrTypeWindows;
    }
    static windowsToRRTypes(windows) {
        const rrtypes = [];
        for (const window of windows) {
            rrtypes.push(...window.rrtypes);
        }
        return rrtypes;
    }
}
exports.NSECRecord = NSECRecord;
//# sourceMappingURL=NSECRecord.js.map