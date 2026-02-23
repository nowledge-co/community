"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AAAARecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const net_1 = tslib_1.__importDefault(require("net"));
const domain_formatter_1 = require("../../util/domain-formatter");
const ResourceRecord_1 = require("../ResourceRecord");
class AAAARecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, ipAddress, flushFlag, ttl) {
        if (typeof name === "string") {
            super(name, 28 /* RType.AAAA */, ttl || AAAARecord.DEFAULT_TTL, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 28 /* RType.AAAA */);
            super(name);
        }
        (0, assert_1.default)(net_1.default.isIPv6(ipAddress), "IP address is not in v6 format!");
        this.ipAddress = ipAddress;
    }
    getRDataEncodingLength() {
        return 16; // 16 byte ipv6 address
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        const address = (0, domain_formatter_1.enlargeIPv6)(this.ipAddress);
        const hextets = address.split(":");
        (0, assert_1.default)(hextets.length === 8, "invalid IP address");
        for (const hextet of hextets) {
            const number = parseInt(hextet, 16);
            buffer.writeUInt16BE(number, offset);
            offset += 2;
        }
        return offset - oldOffset; // written bytes
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        const ipBytes = new Array(8);
        for (let i = 0; i < 8; i++) {
            const number = buffer.readUInt16BE(offset);
            offset += 2;
            ipBytes[i] = number.toString(16);
        }
        const ipAddress = (0, domain_formatter_1.shortenIPv6)(ipBytes.join(":"));
        return {
            data: new AAAARecord(header, ipAddress),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new AAAARecord(this.getRecordRepresentation(), this.ipAddress);
    }
    dataAsString() {
        return this.ipAddress;
    }
    dataEquals(record) {
        return this.ipAddress === record.ipAddress;
    }
}
exports.AAAARecord = AAAARecord;
AAAARecord.DEFAULT_TTL = AAAARecord.RR_DEFAULT_TTL_SHORT;
//# sourceMappingURL=AAAARecord.js.map