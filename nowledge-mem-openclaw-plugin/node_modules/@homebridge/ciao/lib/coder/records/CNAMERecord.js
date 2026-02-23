"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CNAMERecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const dns_equal_1 = require("../../util/dns-equal");
const ResourceRecord_1 = require("../ResourceRecord");
class CNAMERecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, cname, flushFlag, ttl) {
        if (typeof name === "string") {
            super(name, 5 /* RType.CNAME */, ttl, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 5 /* RType.CNAME */);
            super(name);
        }
        if (!cname.endsWith(".")) {
            cname += ".";
        }
        this.cname = cname;
    }
    getLowerCasedCName() {
        return this.lowerCasedCName || (this.lowerCasedCName = (0, dns_equal_1.dnsLowerCase)(this.cname));
    }
    getRDataEncodingLength(coder) {
        return coder.getNameLength(this.cname);
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        const cnameLength = coder.encodeName(this.cname, offset);
        offset += cnameLength;
        return offset - oldOffset; // written bytes
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        const decodedName = coder.decodeName(offset);
        offset += decodedName.readBytes;
        return {
            data: new CNAMERecord(header, decodedName.data),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new CNAMERecord(this.getRecordRepresentation(), this.cname);
    }
    dataAsString() {
        return this.cname;
    }
    dataEquals(record) {
        return this.getLowerCasedCName() === record.getLowerCasedCName();
    }
}
exports.CNAMERecord = CNAMERecord;
CNAMERecord.DEFAULT_TTL = ResourceRecord_1.ResourceRecord.RR_DEFAULT_TTL;
//# sourceMappingURL=CNAMERecord.js.map