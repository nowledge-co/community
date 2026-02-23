"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dnsTypeToString = dnsTypeToString;
function dnsTypeToString(type) {
    switch (type) {
        case 1:
            return "A";
        case 5:
            return "CNAME";
        case 12:
            return "PTR";
        case 16:
            return "TXT";
        case 28:
            return "AAAA";
        case 33:
            return "SRV";
        case 41:
            return "OPT";
        case 47:
            return "NSEC";
        case 255:
            return "ANY";
    }
    return "UNSUPPORTED_" + type;
}
//# sourceMappingURL=dns-string-utils.js.map