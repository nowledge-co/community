"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TXTRecord = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const ResourceRecord_1 = require("../ResourceRecord");
class TXTRecord extends ResourceRecord_1.ResourceRecord {
    constructor(name, txt, flushFlag, ttl) {
        if (typeof name === "string") {
            super(name, 16 /* RType.TXT */, ttl, flushFlag);
        }
        else {
            (0, assert_1.default)(name.type === 16 /* RType.TXT */);
            super(name);
        }
        this.txt = txt.length === 0 ? [Buffer.from([])] : txt;
    }
    getRDataEncodingLength() {
        let length = 0;
        for (const buffer of this.txt) {
            length += 1 + buffer.length;
            (0, assert_1.default)(buffer.length <= 255, "One txt character-string can only have a length of 255 chars");
        }
        return length;
    }
    encodeRData(coder, buffer, offset) {
        const oldOffset = offset;
        for (const txt of this.txt) {
            buffer.writeUInt8(txt.length, offset++);
            txt.copy(buffer, offset);
            offset += txt.length;
        }
        return offset - oldOffset; // written bytes
    }
    clone() {
        return new TXTRecord(this.getRecordRepresentation(), this.txt);
    }
    dataAsString() {
        return `[${this.txt.map(line => `${line.toString("base64")}`).join(",")}]`;
    }
    dataEquals(record) {
        // deepEquals on buffers doesn't really work
        if (this.txt.length !== record.txt.length) {
            return false;
        }
        for (let i = 0; i < this.txt.length; i++) {
            if (this.txt[i].toString("hex") !== record.txt[i].toString("hex")) {
                return false;
            }
        }
        return true;
    }
    static decodeData(coder, header, buffer, offset) {
        const oldOffset = offset;
        const txtData = [];
        while (offset < buffer.length) {
            const length = buffer.readUInt8(offset++);
            txtData.push(buffer.subarray(offset, offset + length));
            offset += length;
        }
        return {
            data: new TXTRecord(header, txtData),
            readBytes: offset - oldOffset,
        };
    }
}
exports.TXTRecord = TXTRecord;
TXTRecord.DEFAULT_TTL = ResourceRecord_1.ResourceRecord.RR_DEFAULT_TTL;
//# sourceMappingURL=TXTRecord.js.map