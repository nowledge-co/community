"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toArray = toArray;
exports.ensureJSON = ensureJSON;
exports.createMultipartFormData = createMultipartFormData;
const node_buffer_1 = require("node:buffer");
const exceptions_js_1 = require("./exceptions.js");
function toArray(maybeArr) {
    return Array.isArray(maybeArr) ? maybeArr : [maybeArr];
}
function ensureJSON(raw) {
    if (typeof raw === "object") {
        return raw;
    }
    else {
        throw new exceptions_js_1.JSONParseError("Failed to parse response body as JSON", { raw });
    }
}
function toArrayBuffer(input) {
    if (input.buffer instanceof ArrayBuffer) {
        return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    const arrayBuffer = new ArrayBuffer(input.byteLength);
    new Uint8Array(arrayBuffer).set(input);
    return arrayBuffer;
}
function createMultipartFormData(formBody) {
    const formData = this instanceof FormData ? this : new FormData();
    for (const [key, value] of Object.entries(formBody)) {
        if (value == null)
            continue;
        if (value instanceof Blob) {
            formData.append(key, value);
        }
        else if (node_buffer_1.Buffer.isBuffer(value) || value instanceof Uint8Array) {
            const arrayBuffer = toArrayBuffer(value);
            formData.append(key, new Blob([arrayBuffer]));
        }
        else {
            formData.append(key, String(value));
        }
    }
    return formData;
}
//# sourceMappingURL=utils.js.map