"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPTRecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const fast_deep_equal_1 = tslib_1.__importDefault(require("fast-deep-equal"));
const ResourceRecord_1 = require("../ResourceRecord");
class OPTRecord extends ResourceRecord_1.ResourceRecord {
    constructor(udpPayloadSize, options, extendedRCode, flags, ednsVersion, ttl) {
        if (typeof udpPayloadSize === "number") {
            super(".", 41 /* RType.OPT */, ttl, false, udpPayloadSize);
            this.udpPayloadSize = udpPayloadSize;
        }
        else {
            (0, assert_1.default)(udpPayloadSize.type === 41 /* RType.OPT */);
            super(udpPayloadSize);
            this.udpPayloadSize = udpPayloadSize.class;
        }
        this.extendedRCode = extendedRCode || 0;
        this.ednsVersion = ednsVersion || OPTRecord.EDNS_VERSION;
        this.flags = {
            dnsSecOK: (flags === null || flags === void 0 ? void 0 : flags.dnsSecOK) || false,
            zero: (flags === null || flags === void 0 ? void 0 : flags.zero) || 0,
            ...flags,
        };
        this.options = options || [];
    }
    getRDataEncodingLength() {
        let length = 0;
        for (const option of this.options) {
            length += 2 + 2 + option.data.length; // 2 byte code; 2 byte length prefix; binary data
        }
        return length;
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        const classOffset = offset - 8;
        const ttlOffset = offset - 6;
        // just to be sure
        buffer.writeUInt16BE(this.udpPayloadSize, classOffset);
        buffer.writeUInt8(this.extendedRCode, ttlOffset);
        buffer.writeUInt8(this.ednsVersion, ttlOffset + 1);
        let flags = this.flags.zero || 0;
        if (this.flags.dnsSecOK) {
            flags |= OPTRecord.DNS_SEC_OK_MASK;
        }
        buffer.writeUInt16BE(flags, ttlOffset + 2);
        for (const option of this.options) {
            buffer.writeUInt16BE(option.code, offset);
            offset += 2;
            buffer.writeUInt16BE(option.data.length, offset);
            offset += 2;
            option.data.copy(buffer, offset);
            offset += option.data.length;
        }
        return offset - oldOffset; // written bytes
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        const classOffset = offset - 8;
        const ttlOffset = offset - 6;
        const udpPayloadSize = buffer.readUInt16BE(classOffset);
        const extendedRCode = buffer.readUInt8(ttlOffset);
        const ednsVersion = buffer.readUInt8(ttlOffset + 1);
        const flagsField = buffer.readUInt16BE(ttlOffset + 2);
        const flags = {
            dnsSecOK: !!(flagsField & OPTRecord.DNS_SEC_OK_MASK),
            zero: flagsField & OPTRecord.NOT_DNS_SEC_OK_MASK,
        };
        const options = [];
        while (offset < buffer.length) {
            const code = buffer.readUInt16BE(offset);
            offset += 2;
            const length = buffer.readUInt16BE(offset);
            offset += 2;
            const data = buffer.subarray(offset, offset + length);
            offset += length;
            options.push({
                code: code,
                data: data,
            });
        }
        header.class = udpPayloadSize;
        header.ttl = 4500; // default
        return {
            data: new OPTRecord(header, options, extendedRCode, flags, ednsVersion),
            readBytes: offset - oldOffset,
        };
    }
    clone() {
        return new OPTRecord(this.getRecordRepresentation(), this.options, this.extendedRCode, this.flags, this.ednsVersion);
    }
    dataAsString() {
        return `${this.udpPayloadSize} ${this.extendedRCode} ${this.ednsVersion} ${JSON.stringify(this.flags)} [${this.options
            .map(opt => `${opt.code} ${opt.data.toString("base64")}`).join(",")}]`;
    }
    dataEquals(record) {
        return this.udpPayloadSize === record.udpPayloadSize && this.extendedRCode === record.extendedRCode
            && this.ednsVersion === record.ednsVersion
            && OPTRecord.optionsEquality(this.options, record.options) && (0, fast_deep_equal_1.default)(this.flags, record.flags);
    }
    static optionsEquality(a, b) {
        // deepEquals on buffers doesn't really work
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i].code !== b[i].code) {
                return false;
            }
            else if (a[i].data.toString("hex") !== b[i].data.toString("hex")) {
                return false;
            }
        }
        return true;
    }
}
exports.OPTRecord = OPTRecord;
OPTRecord.EDNS_VERSION = 0;
OPTRecord.DNS_SEC_OK_MASK = 0x8000; // 2 bytes, first bit set
OPTRecord.NOT_DNS_SEC_OK_MASK = 0x7FFF;
//# sourceMappingURL=OPTRecord.js.map