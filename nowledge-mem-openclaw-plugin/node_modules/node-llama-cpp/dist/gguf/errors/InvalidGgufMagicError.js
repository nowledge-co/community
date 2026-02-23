export class InvalidGgufMagicError extends Error {
    constructor(expectedGgufMagic, actualGgufMagic) {
        super(`Invalid GGUF magic. Expected "${expectedGgufMagic}" but got "${actualGgufMagic}".`);
    }
}
//# sourceMappingURL=InvalidGgufMagicError.js.map