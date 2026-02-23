// Used from https://github.com/discord/discord-interactions-js
function getSubtleCrypto() {
    if (typeof window !== "undefined" && window.crypto) {
        return window.crypto.subtle;
    }
    if (typeof globalThis !== "undefined" && globalThis.crypto) {
        return globalThis.crypto.subtle;
    }
    if (typeof crypto !== "undefined") {
        return crypto.subtle;
    }
    if (typeof require === "function") {
        const cryptoPackage = "node:crypto";
        const crypto = require(cryptoPackage);
        return crypto.webcrypto.subtle;
    }
    throw new Error("No Web Crypto API implementation found");
}
export const subtleCrypto = getSubtleCrypto();
export function valueToUint8Array(value, format) {
    if (value == null) {
        return new Uint8Array();
    }
    if (typeof value === "string") {
        if (format === "hex") {
            const matches = value.match(/.{1,2}/g);
            if (matches == null) {
                throw new Error("Value is not a valid hex string");
            }
            const hexVal = matches.map((byte) => Number.parseInt(byte, 16));
            return new Uint8Array(hexVal);
        }
        return new TextEncoder().encode(value);
    }
    if (Buffer.isBuffer(value)) {
        return new Uint8Array(value);
    }
    if (value instanceof ArrayBuffer) {
        return new Uint8Array(value);
    }
    if (value instanceof Uint8Array) {
        return value;
    }
    throw new Error("Unrecognized value type, must be one of: string, Buffer, ArrayBuffer, Uint8Array");
}
export function concatUint8Arrays(arr1, arr2) {
    const merged = new Uint8Array(arr1.length + arr2.length);
    merged.set(arr1);
    merged.set(arr2, arr1.length);
    return merged;
}
//# sourceMappingURL=verification.js.map