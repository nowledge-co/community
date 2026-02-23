"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceRecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const dns_equal_1 = require("../util/dns-equal");
const dns_string_utils_1 = require("./dns-string-utils");
const DNSLabelCoder_1 = require("./DNSLabelCoder");
const debug = (0, debug_1.default)("ciao:decoder");
class ResourceRecord {
    constructor(name, type, ttl = ResourceRecord.RR_DEFAULT_TTL, flushFlag = false, clazz = 1 /* RClass.IN */) {
        this.flushFlag = false;
        if (typeof name === "string") {
            if (!name.endsWith(".")) {
                name = name + ".";
            }
            this.name = name;
            this.type = type;
            this.class = clazz;
            this.ttl = ttl;
            this.flushFlag = flushFlag;
        }
        else {
            this.name = name.name;
            this.type = name.type;
            this.class = name.class;
            this.ttl = name.ttl;
            this.flushFlag = name.flushFlag;
        }
    }
    getLowerCasedName() {
        return this.lowerCasedName || (this.lowerCasedName = (0, dns_equal_1.dnsLowerCase)(this.name));
    }
    getEncodingLength(coder) {
        return coder.getNameLength(this.name)
            + 10 // 2 bytes TYPE; 2 bytes class, 4 bytes TTL, 2 bytes RDLength
            + this.getRDataEncodingLength(coder);
    }
    encode(coder, buffer, offset) {
        const oldOffset = offset;
        const nameLength = coder.encodeName(this.name, offset);
        offset += nameLength;
        buffer.writeUInt16BE(this.type, offset);
        offset += 2;
        let rClass = this.class;
        if (this.flushFlag) {
            // for pseudo records like OPT, TSIG, TKEY, SIG0 the top bit should not be interpreted as the flush flag
            // though we do not support those (OPT seems to be the only used, though no idea for what [by Apple for mdns])
            rClass |= ResourceRecord.FLUSH_MASK;
        }
        buffer.writeUInt16BE(rClass, offset);
        offset += 2;
        buffer.writeUInt32BE(this.ttl, offset);
        offset += 4;
        const dataLength = this.encodeRData(coder, buffer, offset + 2);
        buffer.writeUInt16BE(dataLength, offset);
        offset += 2 + dataLength;
        return offset - oldOffset; // written bytes
    }
    getRawData() {
        const coder = DNSLabelCoder_1.NonCompressionLabelCoder.INSTANCE; // this forces uncompressed names
        const length = this.getRDataEncodingLength(coder);
        const buffer = Buffer.allocUnsafe(length);
        coder.initBuf(buffer);
        const writtenBytes = this.encodeRData(coder, buffer, 0);
        (0, assert_1.default)(writtenBytes === buffer.length, "Didn't completely write to the buffer! (" + writtenBytes + "!=" + buffer.length + ")");
        coder.initBuf(); // reset buffer to undefined
        return buffer;
    }
    static clone(records) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        return records.map(record => record.clone());
    }
    getRecordRepresentation() {
        return {
            name: this.name,
            type: this.type,
            class: this.class,
            ttl: this.ttl,
            flushFlag: this.flushFlag,
        };
    }
    /**
     * Returns if this and the supplied record are the same (ignoring ttl and flush flag)
     * @param record
     */
    aboutEqual(record) {
        return this.type === record.type && this.name === record.name && this.class === record.class
            && this.dataEquals(record);
    }
    representsSameData(record) {
        return this.type === record.type && this.name === record.name && this.class === record.class;
    }
    asString() {
        // same as aboutEqual, ttl is not included
        return `RR ${this.name} ${this.type} ${this.class} ${this.dataAsString()}`;
    }
    static decode(context, coder, buffer, offset) {
        const oldOffset = offset;
        const decodedHeader = this.decodeRecordHeader(coder, buffer, offset);
        offset += decodedHeader.readBytes;
        const header = decodedHeader.data;
        const rrDecoder = this.typeToRecordDecoder.get(header.type);
        if (!rrDecoder) {
            return { readBytes: (offset + header.rDataLength) - oldOffset };
        }
        coder.initRRLocation(oldOffset, offset, header.rDataLength); // defines record offset and rdata offset for local compression
        const rdata = buffer.subarray(0, offset + header.rDataLength);
        let decodedRecord;
        try {
            // we slice the buffer (below), so out of bounds error are instantly detected
            decodedRecord = rrDecoder(coder, header, rdata, offset);
        }
        catch (error) {
            debug(`Received malformed rdata section for ${(0, dns_string_utils_1.dnsTypeToString)(header.type)} ${header.name} ${header.ttl} \
from ${context.address}:${context.port} with data '${rdata.subarray(offset).toString("hex")}': ${error.stack}`);
            return { readBytes: (offset + header.rDataLength) - oldOffset };
        }
        offset += decodedRecord.readBytes;
        coder.clearRRLocation();
        return {
            data: decodedRecord.data,
            readBytes: offset - oldOffset,
        };
    }
    static decodeRecordHeader(coder, buffer, offset) {
        const oldOffset = offset;
        const decodedName = coder.decodeName(offset);
        offset += decodedName.readBytes;
        const type = buffer.readUInt16BE(offset);
        offset += 2;
        const rClass = buffer.readUInt16BE(offset);
        offset += 2;
        let clazz;
        let flushFlag = false;
        if (type !== 41 /* RType.OPT */) {
            clazz = (rClass & this.NOT_FLUSH_MASK);
            flushFlag = !!(rClass & this.FLUSH_MASK);
        }
        else {
            // OPT class field encodes udpPayloadSize field
            clazz = rClass;
        }
        const ttl = buffer.readUInt32BE(offset);
        offset += 4;
        const rDataLength = buffer.readUInt16BE(offset);
        offset += 2;
        const rHeader = {
            name: decodedName.data,
            type: type,
            class: clazz,
            ttl: ttl,
            flushFlag: flushFlag,
            rDataLength: rDataLength,
        };
        return {
            data: rHeader,
            readBytes: offset - oldOffset,
        };
    }
}
exports.ResourceRecord = ResourceRecord;
ResourceRecord.typeToRecordDecoder = new Map();
ResourceRecord.FLUSH_MASK = 0x8000; // 2 bytes, first bit set
ResourceRecord.NOT_FLUSH_MASK = 0x7FFF;
ResourceRecord.RR_DEFAULT_TTL_SHORT = 120; // 120 seconds
ResourceRecord.RR_DEFAULT_TTL = 4500; // 75 minutes
//# sourceMappingURL=ResourceRecord.js.map