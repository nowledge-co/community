import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
function s2b(str, encoding) {
    return Buffer.from(str, encoding);
}
function safeCompare(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    return timingSafeEqual(a, b);
}
export default function validateSignature(body, channelSecret, signature) {
    return safeCompare(createHmac("SHA256", channelSecret).update(body).digest(), s2b(signature, "base64"));
}
//# sourceMappingURL=validate-signature.js.map