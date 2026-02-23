"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = validateSignature;
const node_buffer_1 = require("node:buffer");
const node_crypto_1 = require("node:crypto");
function s2b(str, encoding) {
    return node_buffer_1.Buffer.from(str, encoding);
}
function safeCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(a, b);
}
function validateSignature(body, channelSecret, signature) {
    return safeCompare((0, node_crypto_1.createHmac)("SHA256", channelSecret).update(body).digest(), s2b(signature, "base64"));
}
//# sourceMappingURL=validate-signature.js.map