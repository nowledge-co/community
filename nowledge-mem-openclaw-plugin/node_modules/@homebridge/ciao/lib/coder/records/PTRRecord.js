"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PTRRecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const dns_equal_1 = require("../../util/dns-equal");
const ResourceRecord_1 = require("../ResourceRecord");
class PTRRecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, ptrName, flushFlag, ttl) {
        if (typeof name === "string") {
            super(name, 12 /* RType.PTR */, ttl, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 12 /* RType.PTR */);
            super(name);
        }
        if (!ptrName.endsWith(".")) {
            ptrName += ".";
        }
        this.ptrName = ptrName;
    }
    getLowerCasedPTRName() {
        return this.lowerCasedPtrName || (this.lowerCasedPtrName = (0, dns_equal_1.dnsLowerCase)(this.ptrName));
    }
    getRDataEncodingLength(coder) {
        return coder.getNameLength(this.ptrName);
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        const ptrNameLength = coder.encodeName(this.ptrName, offset);
        offset += ptrNameLength;
        return offset - oldOffset; // written bytes
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        const decodedName = coder.decodeName(offset);
        offset += decodedName.readBytes;
        return {
            data: new PTRRecord(header, decodedName.data),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new PTRRecord(this.getRecordRepresentation(), this.ptrName);
    }
    dataAsString() {
        return this.ptrName;
    }
    dataEquals(record) {
        return this.getLowerCasedPTRName() === record.getLowerCasedPTRName();
    }
}
exports.PTRRecord = PTRRecord;
PTRRecord.DEFAULT_TTL = ResourceRecord_1.ResourceRecord.RR_DEFAULT_TTL;
//# sourceMappingURL=PTRRecord.js.map