"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isIPv4Mapped = isIPv4Mapped;
exports.getIPFromV4Mapped = getIPFromV4Mapped;
/**
 * Test for the presence of an IPv4-mapped address embedded in an IPv6 address.
 *
 * @param address - IPv6 address
 * @returns true if it is an IPv4-mapped address, false otherwise.
 */
function isIPv4Mapped(address) {
    var _a;
    if (!/^::ffff:(\d{1,3}\.){3}\d{1,3}$/i.test(address)) {
        return false;
    }
    // Split the address apart into it's components and test for validity.
    const parts = (_a = address.split(/::ffff:/i)[1]) === null || _a === void 0 ? void 0 : _a.split(".").map(Number);
    return (parts === null || parts === void 0 ? void 0 : parts.length) === 4 && parts.every(part => part >= 0 && part <= 255);
}
function getIPFromV4Mapped(address) {
    var _a;
    // Split the address apart into it's components and test for validity.
    return (_a = address.split(/^::ffff:/i)[1]) !== null && _a !== void 0 ? _a : null;
}
//# sourceMappingURL=v4mapped.js.map