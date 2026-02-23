"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ARecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const net_1 = tslib_1.__importDefault(require("net"));
const ResourceRecord_1 = require("../ResourceRecord");
class ARecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, ipAddress, flushFlag, ttl) {
        if (typeof name === "string") {
            super(name, 1 /* RType.A */, ttl || ARecord.DEFAULT_TTL, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 1 /* RType.A */);
            super(name);
        }
        (0, assert_1.default)(net_1.default.isIPv4(ipAddress), "IP address is not in IPv4 format!");
        this.ipAddress = ipAddress;
    }
    getRDataEncodingLength() {
        return 4; // 4 byte ipv4 address
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        const bytes = this.ipAddress.split(".");
        (0, assert_1.default)(bytes.length === 4, "invalid ip address");
        for (const byte of bytes) {
            const number = parseInt(byte, 10);
            buffer.writeUInt8(number, offset++);
        }
        return offset - oldOffset; // written bytes
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        const ipBytes = new Array(4);
        for (let i = 0; i < 4; i++) {
            const byte = buffer.readUInt8(offset++);
            ipBytes[i] = byte.toString(10);
        }
        const ipAddress = ipBytes.join(".");
        return {
            data: new ARecord(header, ipAddress),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new ARecord(this.getRecordRepresentation(), this.ipAddress);
    }
    dataAsString() {
        return this.ipAddress;
    }
    dataEquals(record) {
        return this.ipAddress === record.ipAddress;
    }
}
exports.ARecord = ARecord;
ARecord.DEFAULT_TTL = ARecord.RR_DEFAULT_TTL_SHORT;
//# sourceMappingURL=ARecord.js.map