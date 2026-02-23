export class UnsupportedGgufValueTypeError extends Error {
    ggufValueType;
    constructor(ggufValueType) {
        super(`Unsupported GGUF value type "${ggufValueType}"`);
        Object.defineProperty(this, "ggufValueType", { enumerable: false });
        this.ggufValueType = ggufValueType;
    }
}
//# sourceMappingURL=UnsupportedGgufValueTypeError.js.map