"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MDNSServer = void 0;
exports.SendResultFailedRatio = SendResultFailedRatio;
exports.SendResultFormatError = SendResultFormatError;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const dgram_1 = tslib_1.__importDefault(require("dgram"));
const DNSPacket_1 = require("./coder/DNSPacket");
const NetworkManager_1 = require("./NetworkManager");
const domain_formatter_1 = require("./util/domain-formatter");
const errors_1 = require("./util/errors");
const promise_utils_1 = require("./util/promise-utils");
const debug = (0, debug_1.default)("ciao:MDNSServer");
/**
 * Returns the ration of rejected SendResults in the array.
 * A ratio of 0 indicates all sends were successful.
 * A ration of 1 indicates all sends failed.
 * A number in between signals that some of the sends failed.
 *
 * @param results - Array of {@link SendResult}
 */
function SendResultFailedRatio(results) {
    if (results.length === 0) {
        return 0;
    }
    let failedCount = 0;
    for (const result of results) {
        if (result.status !== "fulfilled") {
            failedCount++;
        }
    }
    return failedCount / results.length;
}
function SendResultFormatError(results, prefix, includeStack = false) {
    let failedCount = 0;
    for (const result of results) {
        if (result.status !== "fulfilled") {
            failedCount++;
        }
    }
    if (!prefix) {
        prefix = "Failed to send packets";
    }
    if (failedCount < results.length) {
        prefix += ` (${failedCount}/${results.length}):`;
    }
    else {
        prefix += ":";
    }
    if (includeStack) {
        let string = "=============================\n" + prefix;
        for (const result of results) {
            if (result.status === "rejected") {
                string += "\n--------------------\n" +
                    "Failed to send packet on interface " + result.interface + ": " + result.reason.stack;
            }
            else if (result.status === "timeout") {
                string += "\n--------------------\n" +
                    "Sending packet on interface " + result.interface + " timed out!";
            }
        }
        string += "\n=============================";
        return string;
    }
    else {
        let string = prefix;
        for (const result of results) {
            if (result.status === "rejected") {
                string += "\n- Failed to send packet on interface " + result.interface + ": " + result.reason.message;
            }
            else if (result.status === "timeout") {
                string += "\n- Sending packet on interface " + result.interface + " timed out!";
            }
        }
        return string;
    }
}
/**
 * This class can be used to create a mdns server to send and receive mdns packets on the local network.
 *
 * Currently only udp4 sockets will be advertised.
 */
class MDNSServer {
    constructor(handler, options) {
        this.sockets = new Map();
        this.sentPackets = new Map();
        // RFC 6762 15.1. If we are not the first responder bound to 5353 we can't receive unicast responses
        // thus the QU flag must not be used in queries. Responders are only affected when sending probe queries.
        // Probe queries should be sent with QU set, though can't be sent with QU when we can't receive unicast responses.
        this.suppressUnicastResponseFlag = false;
        this.bound = false;
        this.closed = false;
        this.advertiseFamilies = [];
        (0, assert_1.default)(handler, "handler cannot be undefined");
        this.handler = handler;
        this.networkManager = new NetworkManager_1.NetworkManager({
            interface: options && options.interface,
            excludeIpv6: options && options.disableIpv6,
            excludeIpv6Only: options && options.excludeIpv6Only,
        });
        if (!(options && options.advertiseIpv4 === false)) {
            // IPv4 advertisements default to on
            this.advertiseFamilies.push("IPv4" /* IPFamily.IPv4 */);
        }
        if (options && options.advertiseIpv6) {
            // IPv6 advertisements default to off
            this.advertiseFamilies.push("IPv6" /* IPFamily.IPv6 */);
        }
        this.networkManager.on("network-update" /* NetworkManagerEvent.NETWORK_UPDATE */, this.handleUpdatedNetworkInterfaces.bind(this));
    }
    getNetworkManager() {
        return this.networkManager;
    }
    getBoundInterfaceNames() {
        return this.sockets.keys();
    }
    async bind() {
        if (this.closed) {
            throw new Error("Cannot rebind closed server!");
        }
        // RFC 6762 15.1. suggest that we probe if we are not the only socket.
        // though as ciao will probably always be installed besides an existing mdns responder, we just assume that without probing
        // As it only affects probe queries, impact isn't that big.
        this.suppressUnicastResponseFlag = true;
        // wait for the first network interfaces to be discovered
        await this.networkManager.waitForInit();
        const promises = [];
        for (const [name, networkInterface] of this.networkManager.getInterfaceMap()) {
            this.advertiseFamilies.forEach((family) => {
                const socket = this.createDgramSocket(name, true, family === "IPv6" /* IPFamily.IPv6 */ ? "udp6" : "udp4");
                const promise = this.bindSocket(socket, networkInterface, family)
                    .catch(reason => {
                    // TODO if bind errors we probably will never bind again
                    console.log("Could not bind detected network interface: " + reason.stack);
                });
                promises.push(promise);
            });
        }
        return Promise.all(promises).then(() => {
            this.bound = true;
            // map void[] to void
        });
    }
    shutdown() {
        this.networkManager.shutdown();
        for (const socket of this.sockets.values()) {
            socket.close();
        }
        this.bound = false;
        this.closed = true;
        this.sockets.clear();
    }
    sendQueryBroadcast(query, service) {
        const packets = DNSPacket_1.DNSPacket.createDNSQueryPackets(query);
        if (packets.length > 1) {
            debug("Query broadcast is split into %d packets!", packets.length);
        }
        const promises = [];
        for (const packet of packets) {
            promises.push(this.sendOnAllNetworksForService(packet, service));
        }
        return Promise.all(promises).then((values) => {
            const results = [];
            for (const value of values) { // replace with .flat method when we have node >= 11.0.0 requirement
                results.concat(value);
            }
            return results;
        });
    }
    sendResponseBroadcast(response, service) {
        const packet = DNSPacket_1.DNSPacket.createDNSResponsePacketsFromRRSet(response);
        return this.sendOnAllNetworksForService(packet, service);
    }
    sendResponse(response, endpointOrInterface, callback) {
        this.send(response, endpointOrInterface).then(result => {
            if (result.status === "rejected") {
                if (callback) {
                    callback(new Error("Encountered socket error on " + result.reason.name + ": " + result.reason.message));
                }
                else {
                    MDNSServer.logSocketError(result.interface, result.reason);
                }
            }
            else if (callback) {
                callback();
            }
        });
    }
    sendOnAllNetworksForService(packet, service) {
        this.checkUnicastResponseFlag(packet);
        const message = packet.encode();
        this.assertBeforeSend(message, "IPv4" /* IPFamily.IPv4 */);
        const promises = [];
        for (const [name, socket] of this.sockets) {
            if (!service.advertisesOnInterface(name)) {
                // I don't like the fact that we put the check inside the MDNSServer, as it should be independent of the above layer.
                // Though I think this is currently the easiest approach.
                continue;
            }
            const isIPv6 = name.endsWith("/6");
            const promise = new Promise(resolve => {
                socket.send(message, MDNSServer.MDNS_PORT, isIPv6 ? MDNSServer.MULTICAST_IPV6 : MDNSServer.MULTICAST_IPV4, error => {
                    if (error) {
                        if (!MDNSServer.isSilencedSocketError(error)) {
                            resolve({
                                status: "rejected",
                                interface: name,
                                reason: error,
                            });
                            return;
                        }
                    }
                    else {
                        this.maintainSentPacketsInterface(name, message);
                    }
                    resolve({
                        status: "fulfilled",
                        interface: name,
                    });
                });
            });
            promises.push(Promise.race([
                promise,
                (0, promise_utils_1.PromiseTimeout)(MDNSServer.SEND_TIMEOUT).then(() => ({
                    status: "timeout",
                    interface: name,
                })),
            ]));
        }
        return Promise.all(promises);
    }
    send(packet, endpointOrInterface) {
        this.checkUnicastResponseFlag(packet);
        const message = packet.encode();
        let address;
        let port;
        let name;
        let isIPv6;
        if (typeof endpointOrInterface === "string") { // its a network interface name
            isIPv6 = endpointOrInterface.endsWith("/6");
            address = isIPv6 ? MDNSServer.MULTICAST_IPV6 : MDNSServer.MULTICAST_IPV4;
            port = MDNSServer.MDNS_PORT;
            name = endpointOrInterface;
        }
        else {
            isIPv6 = endpointOrInterface.interface.endsWith("/6");
            address = endpointOrInterface.address;
            port = endpointOrInterface.port;
            name = endpointOrInterface.interface;
        }
        this.assertBeforeSend(message, isIPv6 ? "IPv6" /* IPFamily.IPv6 */ : "IPv4" /* IPFamily.IPv4 */);
        const socket = this.sockets.get(name);
        if (!socket) {
            throw new errors_1.InterfaceNotFoundError(`Could not find socket for given network interface '${name}'`);
        }
        return new Promise(resolve => {
            socket.send(message, port, address, error => {
                if (error) {
                    if (!MDNSServer.isSilencedSocketError(error)) {
                        resolve({
                            status: "rejected",
                            interface: name,
                            reason: error,
                        });
                        return;
                    }
                }
                else {
                    this.maintainSentPacketsInterface(name, message);
                }
                resolve({
                    status: "fulfilled",
                    interface: name,
                });
            });
        });
    }
    checkUnicastResponseFlag(packet) {
        if (this.suppressUnicastResponseFlag && packet.type === 0 /* PacketType.QUERY */) {
            packet.questions.forEach(record => record.unicastResponseFlag = false);
        }
    }
    assertBeforeSend(message, family) {
        if (this.closed) {
            throw new errors_1.ServerClosedError("Cannot send packets on a closed mdns server!");
        }
        (0, assert_1.default)(this.bound, "Cannot send packets before server is not bound!");
        const ipHeaderSize = family === "IPv4" /* IPFamily.IPv4 */ ? MDNSServer.DEFAULT_IP4_HEADER : MDNSServer.DEFAULT_IP6_HEADER;
        // RFC 6762 17.
        (0, assert_1.default)(ipHeaderSize + MDNSServer.UDP_HEADER + message.length <= 9000, "DNS cannot exceed the size of 9000 bytes even with IP Fragmentation!");
    }
    maintainSentPacketsInterface(name, packet) {
        const base64 = packet.toString("base64");
        const packets = this.sentPackets.get(name);
        if (!packets) {
            this.sentPackets.set(name, [base64]);
        }
        else {
            packets.push(base64);
        }
    }
    checkIfPacketWasPreviouslySentFromUs(name, packet) {
        const base64 = packet.toString("base64");
        const packets = this.sentPackets.get(name);
        if (packets) {
            const index = packets.indexOf(base64);
            if (index !== -1) {
                packets.splice(index, 1);
                return true;
            }
        }
        return false;
    }
    createDgramSocket(name, reuseAddr = false, type = "udp4") {
        const socket = dgram_1.default.createSocket({
            type: type,
            reuseAddr: reuseAddr,
        });
        socket.on("message", (data, rinfo) => this.handleMessage(name, data, rinfo, type === "udp6" ? "IPv6" /* IPFamily.IPv6 */ : "IPv4" /* IPFamily.IPv4 */));
        socket.on("error", error => {
            if (!MDNSServer.isSilencedSocketError(error)) {
                MDNSServer.logSocketError(name, error);
            }
        });
        return socket;
    }
    bindSocket(socket, networkInterface, family) {
        return new Promise((resolve, reject) => {
            const errorHandler = (error) => reject(new Error("Failed to bind on interface " + networkInterface.name + ": " + error.message));
            const isIPv6 = family === "IPv6" /* IPFamily.IPv6 */;
            socket.once("error", errorHandler);
            socket.on("close", () => {
                this.sockets.delete(networkInterface.name + (isIPv6 ? "/6" : ""));
            });
            socket.bind(MDNSServer.MDNS_PORT, () => {
                socket.setRecvBufferSize(800 * 1024); // setting max recv buffer size to 800KiB (Pi will max out at 352KiB)
                socket.removeListener("error", errorHandler);
                const multicastAddress = isIPv6 ? MDNSServer.MULTICAST_IPV6 : MDNSServer.MULTICAST_IPV4;
                const interfaceAddress = isIPv6 ? networkInterface.ipv6 : networkInterface.ipv4;
                // assert(interfaceAddress, "Interface address for " + networkInterface.name + " cannot be undefined!");
                if (!interfaceAddress) {
                    // There isn't necessarily an IPv4 and IPv6 address assigned to every interface even on dual-stack systems
                    console.log("Warning: no " + (isIPv6 ? "IPv6" : "IPv4") + " address available on " + networkInterface.name);
                    try {
                        socket.close();
                    }
                    catch (error) {
                        // Ignore
                    }
                    resolve();
                    return;
                }
                try {
                    socket.addMembership(multicastAddress, interfaceAddress);
                    // socket.setMulticastInterface(isIPv6 ? "::%" + networkInterface.name : interfaceAddress!);
                    socket.setMulticastInterface(isIPv6 ? interfaceAddress + "%" + networkInterface.name : interfaceAddress);
                    socket.setMulticastTTL(MDNSServer.MDNS_TTL); // outgoing multicast datagrams
                    socket.setTTL(MDNSServer.MDNS_TTL); // outgoing unicast datagrams
                    socket.setMulticastLoopback(true); // We can't disable multicast loopback, as otherwise queriers on the same host won't receive our packets
                    this.sockets.set(isIPv6 ? networkInterface.name + "/6" : networkInterface.name, socket);
                    resolve();
                }
                catch (error) {
                    try {
                        socket.close();
                    }
                    catch (error) {
                        debug("Error while closing socket which failed to bind. Error may be expected: " + error.message);
                    }
                    reject(new Error("Error binding socket on " + networkInterface.name + ": " + error.stack));
                }
            });
        });
    }
    handleMessage(name, buffer, rinfo, family) {
        if (!this.bound) {
            return;
        }
        const networkInterface = this.networkManager.getInterface(name);
        if (!networkInterface) {
            debug("Received packet on non existing network interface: %s!", name);
            return;
        }
        if (this.checkIfPacketWasPreviouslySentFromUs(networkInterface.name, buffer)) {
            // multicastLoopback is enabled for every interface, meaning we would receive our own response
            // packets here. Thus, we silence them. We can't disable multicast loopback, as otherwise
            // queriers on the same host won't receive our packets
            return;
        }
        // We have the following problem on linux based platforms:
        // When setting up a socket like above (binding on 0.0.0.0:5353) and then adding membership for 224.0.0.251 for
        // A CERTAIN! interface, we will nonetheless receive packets from ALL other interfaces even the loopback interfaces.
        // This is not the case on platforms like e.g. macOS. There stuff is properly filtered, and we only receive packets
        // for the given interface we specified in our membership.
        // This has the problem, that when receiving packets from other interfaces, that we leak addresses which don't
        // exist on the given interface. We can't do much about it, as in typically multiple subnet networks, it is valid
        // that we receive a packet from an ip address which doesn't belong into the subnet of our given interface.
        // What we can do at least, is the following two things:
        // * if we are listening on the loopback interface, we filter out any traffic which doesn't belong to the loopback interface
        // * if we receive a packet from the loopback interface, we filter those out as well.
        // With that we at least ensure that the loopback address is never sent out to the network.
        // This is what we do below:
        const isIPv6 = family === "IPv6" /* IPFamily.IPv6 */;
        if (isIPv6) {
            if (networkInterface.loopback !== rinfo.address.includes("%lo")) {
                debug("Received packet on a %s interface (%s) which is coming from a %s interface (%s)", networkInterface.loopback ? "loopback" : "non-loopback", name, rinfo.address.includes("%lo") ? "loopback" : "non-loopback", rinfo.address);
                // return;
            }
        }
        else {
            const ip4Netaddress = (0, domain_formatter_1.getNetAddress)(rinfo.address, networkInterface.ip4Netmask);
            if (networkInterface.loopback) {
                if (ip4Netaddress !== networkInterface.ipv4Netaddress) {
                    return;
                }
            }
            else if (this.networkManager.isLoopbackNetaddressV4(ip4Netaddress)) {
                debug("Received packet on interface '%s' which is not coming from the same subnet: %o", name, { address: rinfo.address, netaddress: ip4Netaddress, interface: networkInterface.ipv4 });
                return;
            }
        }
        let packet;
        try {
            packet = DNSPacket_1.DNSPacket.decode(rinfo, buffer);
        }
        catch (error) {
            debug("Received a malformed packet from %o on interface %s. This might or might not be a problem. " +
                "Here is the received packet for debugging purposes '%s'. " +
                "Packet decoding failed with %s", rinfo, name, buffer.toString("base64"), error.stack);
            return;
        }
        if (packet.opcode !== 0 /* OpCode.QUERY */) {
            // RFC 6762 18.3 we MUST ignore messages with opcodes other than zero (QUERY)
            return;
        }
        if (packet.rcode !== 0 /* RCode.NoError */) {
            // RFC 6762 18.3 we MUST ignore messages with response code other than zero (NoError)
            return;
        }
        const endpoint = {
            address: rinfo.address,
            port: rinfo.port,
            interface: name + (isIPv6 ? "/6" : ""),
        };
        if (packet.type === 0 /* PacketType.QUERY */) {
            try {
                this.handler.handleQuery(packet, endpoint);
            }
            catch (error) {
                console.warn("Error occurred handling incoming (on " + name + ") dns query packet: " + error.stack);
            }
        }
        else if (packet.type === 1 /* PacketType.RESPONSE */) {
            if (rinfo.port !== MDNSServer.MDNS_PORT) {
                // RFC 6762 6.  Multicast DNS implementations MUST silently ignore any Multicast DNS responses
                //    they receive where the source UDP port is not 5353.
                return;
            }
            try {
                this.handler.handleResponse(packet, endpoint);
            }
            catch (error) {
                console.warn("Error occurred handling incoming (on " + name + ") dns response packet: " + error.stack);
            }
        }
    }
    static isSilencedSocketError(error) {
        // silence those errors
        // they happen when the host is not reachable (EADDRNOTAVAIL for 224.0.0.251 or EHOSTDOWN for any unicast traffic)
        // caused by yet undetected network changes.
        // as we listen to 0.0.0.0 and the socket stays valid, this is not a problem
        const silenced = error.message.includes("EADDRNOTAVAIL") || error.message.includes("EHOSTDOWN")
            || error.message.includes("ENETUNREACH") || error.message.includes("EHOSTUNREACH")
            || error.message.includes("EPERM") || error.message.includes("EINVAL");
        if (silenced) {
            debug("Silenced and ignored error (This is/should not be a problem, this message is only for informational purposes): " + error.message);
        }
        return silenced;
    }
    static logSocketError(name, error) {
        console.warn(`Encountered MDNS socket error on socket '${name}' : ${error.stack}`);
        return;
    }
    handleUpdatedNetworkInterfaces(networkUpdate) {
        if (networkUpdate.removed) {
            for (const networkInterface of networkUpdate.removed) {
                // Handle IPv4
                let socket = this.sockets.get(networkInterface.name);
                this.sockets.delete(networkInterface.name);
                if (socket) {
                    socket.close();
                }
                // Handle IPv6
                socket = this.sockets.get(networkInterface.name + "/6");
                this.sockets.delete(networkInterface.name + "/6");
                if (socket) {
                    socket.close();
                }
            }
        }
        if (networkUpdate.changes) {
            for (const change of networkUpdate.changes) {
                // Handle IPv4
                let socket = this.sockets.get(change.name);
                if (!change.outdatedIpv4 && change.updatedIpv4) {
                    // this does currently not happen, as we exclude ipv6 only interfaces
                    // thus such a change would be happening through the ADDED array
                    assert_1.default.fail("Reached illegal state! IPv4 address changed from undefined to defined!");
                }
                else if (change.outdatedIpv4 && !change.updatedIpv4) {
                    // this does currently not happen, as we exclude ipv6 only interfaces
                    // thus such a change would be happening through the REMOVED array
                    assert_1.default.fail("Reached illegal state! IPV4 address change from defined to undefined!");
                }
                else if (socket && change.outdatedIpv4 && change.updatedIpv4) {
                    try {
                        socket.dropMembership(MDNSServer.MULTICAST_IPV4, change.outdatedIpv4);
                    }
                    catch (error) {
                        debug("Thrown unexpected error when dropping outdated address membership: " + error.message);
                    }
                    try {
                        socket.addMembership(MDNSServer.MULTICAST_IPV4, change.updatedIpv4);
                    }
                    catch (error) {
                        debug("Thrown unexpected error when adding new address membership: " + error.message);
                    }
                    socket.setMulticastInterface(change.updatedIpv4);
                }
                // Handle IPv6
                socket = this.sockets.get(change.name + "/6");
                if (socket && change.outdatedIpv6 && change.updatedIpv6) {
                    try {
                        socket.dropMembership(MDNSServer.MULTICAST_IPV6, change.outdatedIpv6);
                    }
                    catch (error) {
                        debug("Thrown unexpected error when dropping outdated address membership: " + error.message);
                    }
                    try {
                        socket.addMembership(MDNSServer.MULTICAST_IPV6, change.updatedIpv6);
                    }
                    catch (error) {
                        debug("Thrown unexpected error when adding new address membership: " + error.message);
                    }
                }
            }
        }
        if (networkUpdate.added) {
            for (const networkInterface of networkUpdate.added) {
                this.advertiseFamilies.forEach((family) => {
                    const socket = this.createDgramSocket(networkInterface.name, true, family === "IPv6" /* IPFamily.IPv6 */ ? "udp6" : "udp4");
                    this.bindSocket(socket, networkInterface, family).catch(reason => {
                        // TODO if bind errors we probably will never bind again
                        console.log("Could not bind detected network interface: " + reason.stack);
                    });
                });
            }
        }
    }
}
exports.MDNSServer = MDNSServer;
MDNSServer.DEFAULT_IP4_HEADER = 20;
MDNSServer.DEFAULT_IP6_HEADER = 40;
MDNSServer.UDP_HEADER = 8;
MDNSServer.MDNS_PORT = 5353;
MDNSServer.MDNS_TTL = 255;
MDNSServer.MULTICAST_IPV4 = "224.0.0.251";
MDNSServer.MULTICAST_IPV6 = "FF02::FB";
MDNSServer.SEND_TIMEOUT = 200; // milliseconds
//# sourceMappingURL=MDNSServer.js.map