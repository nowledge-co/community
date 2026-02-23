"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseFQDN = parseFQDN;
exports.stringify = stringify;
exports.formatHostname = formatHostname;
exports.removeTLD = removeTLD;
exports.formatMappedIPv4Address = formatMappedIPv4Address;
exports.enlargeIPv6 = enlargeIPv6;
exports.shortenIPv6 = shortenIPv6;
exports.formatReverseAddressPTRName = formatReverseAddressPTRName;
exports.ipAddressFromReversAddressName = ipAddressFromReversAddressName;
exports.getNetAddress = getNetAddress;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const net_1 = tslib_1.__importDefault(require("net"));
const v4mapped_1 = require("./v4mapped");
function isProtocol(part) {
    return part === "_" + "tcp" /* Protocol.TCP */ || part === "_" + "udp" /* Protocol.UDP */;
}
function isSub(part) {
    return part === "_sub";
}
function removePrefixedUnderscore(part) {
    return part.startsWith("_") ? part.slice(1) : part;
}
function isSubTypePTRParts(parts) {
    return "subtype" in parts;
}
function parseFQDN(fqdn) {
    const parts = fqdn.split(".");
    (0, assert_1.default)(parts.length >= 3, "Received illegal fqdn: " + fqdn);
    let i = parts.length - 1;
    let domain = "";
    while (!isProtocol(parts[i])) {
        domain = removePrefixedUnderscore(parts[i]) + (domain ? "." + domain : "");
        i--;
    }
    (0, assert_1.default)(i >= 1, "Failed to parse illegal fqdn: " + fqdn);
    const protocol = removePrefixedUnderscore(parts[i--]);
    const type = removePrefixedUnderscore(parts[i--]);
    if (i < 0) {
        return {
            domain: domain,
            protocol: protocol,
            type: type,
        };
    }
    else if (isSub(parts[i])) {
        i--; // skip "_sub";
        (0, assert_1.default)(i === 0, "Received illegal formatted sub type fqdn: " + fqdn);
        const subtype = removePrefixedUnderscore(parts[i]);
        return {
            domain: domain,
            protocol: protocol,
            type: type,
            subtype: subtype,
        };
    }
    else {
        // the name can contain dots as of RFC 6763 4.1.1.
        const name = removePrefixedUnderscore(parts.slice(0, i + 1).join("."));
        return {
            domain: domain,
            protocol: protocol,
            type: type,
            name: name,
        };
    }
}
function stringify(parts) {
    (0, assert_1.default)(parts.type, "type cannot be undefined");
    (0, assert_1.default)(parts.type.length <= 15, "type must not be longer than 15 characters");
    let prefix;
    if (isSubTypePTRParts(parts)) {
        prefix = `_${parts.subtype}._sub.`;
    }
    else {
        prefix = parts.name ? `${parts.name}.` : "";
    }
    return `${prefix}_${parts.type}._${parts.protocol || "tcp" /* Protocol.TCP */}.${parts.domain || "local"}.`;
}
function formatHostname(hostname, domain = "local") {
    (0, assert_1.default)(!hostname.endsWith("."), "hostname must not end with the root label!");
    const tld = "." + domain;
    return (!hostname.endsWith(tld) ? hostname + tld : hostname) + ".";
}
function removeTLD(hostname) {
    if (hostname.endsWith(".")) { // check for the DNS root label
        hostname = hostname.substring(0, hostname.length - 1);
    }
    const lastDot = hostname.lastIndexOf(".");
    return hostname.slice(0, lastDot);
}
function formatMappedIPv4Address(address) {
    if (!(0, v4mapped_1.isIPv4Mapped)(address)) {
        (0, assert_1.default)(net_1.default.isIPv4(address), "Illegal argument. Must be an IPv4 address!");
    }
    (0, assert_1.default)(net_1.default.isIPv4(address), "Illegal argument. Must be an IPv4 address!");
    // Convert IPv4 address to its hexadecimal representation
    const hexParts = address.split(".").map(part => parseInt(part).toString(16).padStart(2, "0"));
    const ipv6Part = `::ffff:${hexParts.join("")}`;
    // Convert the hexadecimal representation to the standard IPv6 format
    return ipv6Part.replace(/(.{4})(.{4})$/, "$1:$2");
}
function enlargeIPv6(address) {
    (0, assert_1.default)(net_1.default.isIPv6(address), "Illegal argument. Must be ipv6 address!");
    const parts = address.split("::");
    // Initialize head and tail arrays
    const head = parts[0] ? parts[0].split(":") : [];
    const tail = parts[1] ? parts[1].split(":") : [];
    // Calculate the number of groups to fill in with "0000" when we expand
    const fill = new Array(8 - head.length - tail.length).fill("0000");
    // Combine it all and normalize each hextet to be 4 characters long
    return [...head, ...fill, ...tail].map(hextet => hextet.padStart(4, "0")).join(":");
}
function shortenIPv6(address) {
    if (typeof address === "string") {
        address = address.split(":");
    }
    for (let i = 0; i < address.length; i++) {
        const part = address[i];
        let j = 0;
        for (; j < Math.min(3, part.length - 1); j++) { // search for the first index which is non-zero, but leaving at least one zero
            if (part.charAt(j) !== "0") {
                break;
            }
        }
        address[i] = part.substr(j);
    }
    let longestBlockOfZerosIndex = -1;
    let longestBlockOfZerosLength = 0;
    for (let i = 0; i < address.length; i++) { // this is not very optimized, but it works
        if (address[i] !== "0") {
            continue;
        }
        let zerosCount = 1;
        let j = i + 1;
        for (; j < address.length; j++) {
            if (address[j] === "0") {
                zerosCount++;
            }
            else {
                break;
            }
        }
        if (zerosCount > longestBlockOfZerosLength) {
            longestBlockOfZerosIndex = i;
            longestBlockOfZerosLength = zerosCount;
        }
        i = j; // skip all the zeros we already checked + the one after that, we know that's not a zero
    }
    if (longestBlockOfZerosIndex !== -1) {
        const startOrEnd = longestBlockOfZerosIndex === 0 || (longestBlockOfZerosIndex + longestBlockOfZerosLength === 8);
        address[longestBlockOfZerosIndex] = startOrEnd ? ":" : "";
        if (longestBlockOfZerosLength > 1) {
            address.splice(longestBlockOfZerosIndex + 1, longestBlockOfZerosLength - 1);
        }
    }
    const result = address.join(":");
    if (result === ":") { // special case for the unspecified address
        return "::";
    }
    return result;
}
function formatReverseAddressPTRName(address) {
    if (net_1.default.isIPv4(address)) {
        const split = address.split(".").reverse();
        return split.join(".") + ".in-addr.arpa";
    }
    if (!net_1.default.isIPv6(address)) {
        throw new Error("Supplied illegal ip address format: " + address);
    }
    if ((0, v4mapped_1.isIPv4Mapped)(address)) {
        return (0, v4mapped_1.getIPFromV4Mapped)(address).split(".").reverse().join(".") + ".in-addr.arpa";
    }
    address = enlargeIPv6(address).toUpperCase();
    const nibbleSplit = address.replace(/:/g, "").split("").reverse();
    (0, assert_1.default)(nibbleSplit.length === 32, "Encountered invalid ipv6 address length! " + nibbleSplit.length);
    return nibbleSplit.join(".") + ".ip6.arpa";
}
function ipAddressFromReversAddressName(name) {
    name = name.toLowerCase();
    if (name.endsWith(".in-addr.arpa")) {
        const split = name.replace(".in-addr.arpa", "").split(".").reverse();
        return split.join(".");
    }
    else if (name.endsWith(".ip6.arpa")) {
        const split = name.replace(".ip6.arpa", "").split(".").reverse();
        (0, assert_1.default)(split.length === 32, "Encountered illegal length for .ip6.arpa split!");
        const parts = [];
        for (let i = 0; i < split.length; i += 4) {
            parts.push(split.slice(i, i + 4).join(""));
        }
        return shortenIPv6(parts.join(":"));
    }
    else {
        throw new Error("Supplied unknown reverse address name format: " + name);
    }
}
function getNetAddress(address, netmask) {
    (0, assert_1.default)(net_1.default.isIP(address) === net_1.default.isIP(netmask), "IP address version must match. Netmask cannot have a version different from the address!");
    if (net_1.default.isIPv4(address)) {
        const addressParts = address.split(".");
        const netmaskParts = netmask.split(".");
        const netAddressParts = new Array(4);
        for (let i = 0; i < addressParts.length; i++) {
            const addressNum = parseInt(addressParts[i]);
            const netmaskNum = parseInt(netmaskParts[i]);
            netAddressParts[i] = (addressNum & netmaskNum).toString();
        }
        return netAddressParts.join(".");
    }
    else if (net_1.default.isIPv6(address)) {
        const addressParts = enlargeIPv6(address).split(":");
        const netmaskParts = enlargeIPv6(netmask).split(":");
        const netAddressParts = new Array(8);
        for (let i = 0; i < addressParts.length; i++) {
            const addressNum = parseInt(addressParts[i], 16);
            const netmaskNum = parseInt(netmaskParts[i], 16);
            netAddressParts[i] = (addressNum & netmaskNum).toString(16);
        }
        return shortenIPv6(enlargeIPv6(netAddressParts.join(":")));
    }
    else {
        throw new Error("Illegal argument. Address is not an ip address!");
    }
}
//# sourceMappingURL=domain-formatter.js.map