"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Question = void 0;
const dns_equal_1 = require("../util/dns-equal");
class Question {
    constructor(name, type, unicastResponseFlag = false, clazz = 1 /* QClass.IN */) {
        this.unicastResponseFlag = false;
        if (!name.endsWith(".")) {
            name += ".";
        }
        this.name = name;
        this.type = type;
        this.class = clazz;
        this.unicastResponseFlag = unicastResponseFlag;
    }
    getLowerCasedName() {
        return this.lowerCasedName || (this.lowerCasedName = (0, dns_equal_1.dnsLowerCase)(this.name));
    }
    getEncodingLength(coder) {
        return coder.getNameLength(this.name) + 4; // 2 bytes type; 2 bytes class
    }
    encode(coder, buffer, offset) {
        const oldOffset = offset;
        const nameLength = coder.encodeName(this.name, offset);
        offset += nameLength;
        buffer.writeUInt16BE(this.type, offset);
        offset += 2;
        let qClass = this.class;
        if (this.unicastResponseFlag) {
            qClass |= Question.QU_MASK;
        }
        buffer.writeUInt16BE(qClass, offset);
        offset += 2;
        return offset - oldOffset; // written bytes
    }
    clone() {
        return new Question(this.name, this.type, this.unicastResponseFlag, this.class);
    }
    asString() {
        return `Q ${this.name} ${this.type} ${this.class}`;
    }
    static decode(context, coder, buffer, offset) {
        const oldOffset = offset;
        const decodedName = coder.decodeName(offset);
        offset += decodedName.readBytes;
        const type = buffer.readUInt16BE(offset);
        offset += 2;
        const qClass = buffer.readUInt16BE(offset);
        offset += 2;
        const clazz = (qClass & this.NOT_QU_MASK);
        const quFlag = !!(qClass & this.QU_MASK);
        const question = new Question(decodedName.data, type, quFlag, clazz);
        return {
            data: question,
            readBytes: offset - oldOffset,
        };
    }
}
exports.Question = Question;
Question.QU_MASK = 0x8000; // 2 bytes, first bit set
Question.NOT_QU_MASK = 0x7FFF;
//# sourceMappingURL=Question.js.map