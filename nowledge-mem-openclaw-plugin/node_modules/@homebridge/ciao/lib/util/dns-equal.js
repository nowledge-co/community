"use strict";
// name equality checks according to RFC 1035 3.1
Object.defineProperty(exports, "__esModule", { value: true });
exports.dnsLowerCase = dnsLowerCase;
const asciiPattern = /[A-Z]/g;
function dnsLowerCase(value) {
    return value.replace(asciiPattern, s => s.toLowerCase());
}
//# sourceMappingURL=dns-equal.js.map