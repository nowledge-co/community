export class GgufReadOffset {
    offset;
    constructor(offset) {
        if (offset instanceof GgufReadOffset)
            this.offset = offset.offset;
        else
            this.offset = offset;
    }
    moveBy(amount) {
        this.offset += amount;
    }
    static resolveReadOffset(offset) {
        if (offset instanceof GgufReadOffset)
            return offset;
        return new GgufReadOffset(offset);
    }
}
//# sourceMappingURL=GgufReadOffset.js.map