"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SRVRecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const dns_equal_1 = require("../../util/dns-equal");
const ResourceRecord_1 = require("../ResourceRecord");
class SRVRecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, hostname, port, flushFlag, ttl) {
        if (typeof name === "string") {
            super(name, 33 /* RType.SRV */, ttl || SRVRecord.RR_DEFAULT_TTL_SHORT, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 33 /* RType.SRV */);
            super(name);
        }
        if (!hostname.endsWith(".")) {
            this.hostname = hostname + ".";
        }
        else {
            this.hostname = hostname;
        }
        this.port = port;
        // priority and weight are not supported to encode or read
        this.priority = 0;
        this.weight = 0;
    }
    getLowerCasedHostname() {
        return this.lowerCasedHostname || (this.lowerCasedHostname = (0, dns_equal_1.dnsLowerCase)(this.hostname));
    }
    getRDataEncodingLength(coder) {
        return 6 // 2 byte priority; 2 byte weight; 2 byte port;
            // as of RFC 2782 name compression MUST NOT be used for the hostname, though RFC 6762 18.14 specifies it should
            + (coder.legacyUnicastEncoding
                ? coder.getUncompressedNameLength(this.hostname)
                : coder.getNameLength(this.hostname));
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        buffer.writeUInt16BE(this.priority, offset);
        offset += 2;
        buffer.writeUInt16BE(this.weight, offset);
        offset += 2;
        buffer.writeUInt16BE(this.port, offset);
        offset += 2;
        const hostnameLength = coder.legacyUnicastEncoding
            ? coder.encodeUncompressedName(this.hostname, offset)
            : coder.encodeName(this.hostname, offset);
        offset += hostnameLength;
        return offset - oldOffset; // written bytes
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        //const priority = buffer.readUInt16BE(offset);
        offset += 2;
        //const weight = buffer.readUInt16BE(offset);
        offset += 2;
        const port = buffer.readUInt16BE(offset);
        offset += 2;
        const decodedHostname = coder.decodeName(offset);
        offset += decodedHostname.readBytes;
        return {
            data: new SRVRecord(header, decodedHostname.data, port),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new SRVRecord(this.getRecordRepresentation(), this.hostname, this.port);
    }
    dataAsString() {
        return `${this.hostname} ${this.port} ${this.priority} ${this.weight}`;
    }
    dataEquals(record) {
        return this.getLowerCasedHostname() === record.getLowerCasedHostname() && this.port === record.port && this.weight === record.weight && this.priority === record.priority;
    }
}
exports.SRVRecord = SRVRecord;
SRVRecord.DEFAULT_TTL = 120;
//# sourceMappingURL=SRVRecord.js.map