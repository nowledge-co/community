export declare class GgufReadOffset {
    offset: number;
    constructor(offset: number | GgufReadOffset);
    moveBy(amount: number): void;
    static resolveReadOffset(offset: number | GgufReadOffset): GgufReadOffset;
}
