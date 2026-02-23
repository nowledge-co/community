"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetworkManager = exports.NetworkManagerEvent = exports.WifiState = exports.IPFamily = void 0;
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
const assert_1 = tslib_1.__importDefault(require("assert"));
const child_process_1 = tslib_1.__importDefault(require("child_process"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const events_1 = require("events");
const fast_deep_equal_1 = tslib_1.__importDefault(require("fast-deep-equal"));
const net_1 = tslib_1.__importDefault(require("net"));
const os_1 = tslib_1.__importDefault(require("os"));
const domain_formatter_1 = require("./util/domain-formatter");
const debug = (0, debug_1.default)("ciao:NetworkManager");
var IPFamily;
(function (IPFamily) {
    IPFamily["IPv4"] = "IPv4";
    IPFamily["IPv6"] = "IPv6";
})(IPFamily || (exports.IPFamily = IPFamily = {}));
var WifiState;
(function (WifiState) {
    WifiState[WifiState["UNDEFINED"] = 0] = "UNDEFINED";
    WifiState[WifiState["NOT_A_WIFI_INTERFACE"] = 1] = "NOT_A_WIFI_INTERFACE";
    WifiState[WifiState["NOT_ASSOCIATED"] = 2] = "NOT_ASSOCIATED";
    WifiState[WifiState["CONNECTED"] = 3] = "CONNECTED";
})(WifiState || (exports.WifiState = WifiState = {}));
var NetworkManagerEvent;
(function (NetworkManagerEvent) {
    NetworkManagerEvent["NETWORK_UPDATE"] = "network-update";
})(NetworkManagerEvent || (exports.NetworkManagerEvent = NetworkManagerEvent = {}));
/**
 * The NetworkManager maintains a representation of the network interfaces define on the host system.
 * It periodically checks for updated network information.
 *
 * The NetworkManager makes the following decision when checking for interfaces:
 * * First of all it gathers the default network interface of the system (by checking the routing table of the os)
 * * The following interfaces are going to be tracked:
 *   * The loopback interface
 *   * All interfaces which match the subnet of the default interface
 *   * All interfaces which contain a globally unique (aka globally routable) ipv6 address
 */
class NetworkManager extends events_1.EventEmitter {
    constructor(options) {
        super();
        this.currentInterfaces = new Map();
        /**
         * A subset of our network interfaces, holding only loopback interfaces (or what node considers "internal").
         */
        this.loopbackInterfaces = new Map();
        this.setMaxListeners(100); // we got one listener for every Responder, 100 should be fine for now
        if (options && options.interface) {
            let interfaces;
            if (typeof options.interface === "string") {
                interfaces = [options.interface];
            }
            else if (Array.isArray(options.interface)) {
                interfaces = options.interface;
            }
            else {
                throw new Error("Found invalid type for 'interfaces' NetworkManager option!");
            }
            const restrictedInterfaces = [];
            for (const iface of interfaces) {
                if (net_1.default.isIP(iface)) {
                    const interfaceName = NetworkManager.resolveInterface(iface);
                    if (interfaceName) {
                        restrictedInterfaces.push(interfaceName);
                    }
                    else {
                        console.log("CIAO: Interface was specified as ip (%s), though couldn't find a matching interface for the given address.", options.interface);
                    }
                }
                else {
                    restrictedInterfaces.push(iface);
                }
            }
            if (restrictedInterfaces.length === 0) {
                console.log("CIAO: 'restrictedInterfaces' array was empty. Going to fallback to bind on all available interfaces.");
            }
            else {
                this.restrictedInterfaces = restrictedInterfaces;
            }
        }
        this.excludeIpv6 = !!(options && options.excludeIpv6);
        this.excludeIpv6Only = this.excludeIpv6 || !!(options && options.excludeIpv6Only);
        if (options) {
            debug("Created NetworkManager with options: %s", JSON.stringify(options));
        }
        this.initPromise = new Promise(resolve => {
            this.getCurrentNetworkInterfaces().then(map => {
                this.currentInterfaces = map;
                const otherInterfaces = Object.keys(os_1.default.networkInterfaces());
                const interfaceNames = [];
                for (const name of this.currentInterfaces.keys()) {
                    interfaceNames.push(name);
                    const index = otherInterfaces.indexOf(name);
                    if (index !== -1) {
                        otherInterfaces.splice(index, 1);
                    }
                }
                debug("Initial networks [%s] ignoring [%s]", interfaceNames.join(", "), otherInterfaces.join(", "));
                this.initPromise = undefined;
                resolve();
                this.scheduleNextJob();
            });
        });
    }
    async waitForInit() {
        if (this.initPromise) {
            await this.initPromise;
        }
    }
    shutdown() {
        if (this.currentTimer) {
            clearTimeout(this.currentTimer);
            this.currentTimer = undefined;
        }
        this.removeAllListeners();
    }
    getInterfaceMap() {
        if (this.initPromise) {
            assert_1.default.fail("Not yet initialized!");
        }
        return this.currentInterfaces;
    }
    getInterface(name) {
        if (this.initPromise) {
            assert_1.default.fail("Not yet initialized!");
        }
        return this.currentInterfaces.get(name);
    }
    isLoopbackNetaddressV4(netaddress) {
        for (const networkInterface of this.loopbackInterfaces.values()) {
            if (networkInterface.ipv4Netaddress === netaddress) {
                return true;
            }
        }
        return false;
    }
    scheduleNextJob() {
        this.currentTimer = setTimeout(this.checkForNewInterfaces.bind(this), NetworkManager.POLLING_TIME);
        this.currentTimer.unref(); // this timer won't prevent shutdown
    }
    async checkForNewInterfaces() {
        const latestInterfaces = await this.getCurrentNetworkInterfaces();
        if (!this.currentTimer) { // if the timer is undefined, NetworkManager was shut down
            return;
        }
        let added = undefined;
        let removed = undefined;
        let changes = undefined;
        for (const [name, networkInterface] of latestInterfaces) {
            const currentInterface = this.currentInterfaces.get(name);
            if (currentInterface) { // the interface could potentially have changed
                if (!(0, fast_deep_equal_1.default)(currentInterface, networkInterface)) {
                    // indeed the interface changed
                    const change = {
                        name: name,
                    };
                    if (currentInterface.ipv4 !== networkInterface.ipv4) { // check for changed ipv4
                        if (currentInterface.ipv4) {
                            change.outdatedIpv4 = currentInterface.ipv4;
                        }
                        if (networkInterface.ipv4) {
                            change.updatedIpv4 = networkInterface.ipv4;
                        }
                    }
                    if (currentInterface.ipv6 !== networkInterface.ipv6) { // check for changed link-local ipv6
                        if (currentInterface.ipv6) {
                            change.outdatedIpv6 = currentInterface.ipv6;
                        }
                        if (networkInterface.ipv6) {
                            change.updatedIpv6 = networkInterface.ipv6;
                        }
                    }
                    if (currentInterface.globallyRoutableIpv6 !== networkInterface.globallyRoutableIpv6) { // check for changed routable ipv6
                        if (currentInterface.globallyRoutableIpv6) {
                            change.outdatedGloballyRoutableIpv6 = currentInterface.globallyRoutableIpv6;
                        }
                        if (networkInterface.globallyRoutableIpv6) {
                            change.updatedGloballyRoutableIpv6 = networkInterface.globallyRoutableIpv6;
                        }
                    }
                    if (currentInterface.uniqueLocalIpv6 !== networkInterface.uniqueLocalIpv6) { // check for changed ula
                        if (currentInterface.uniqueLocalIpv6) {
                            change.outdatedUniqueLocalIpv6 = currentInterface.uniqueLocalIpv6;
                        }
                        if (networkInterface.uniqueLocalIpv6) {
                            change.updatedUniqueLocalIpv6 = networkInterface.uniqueLocalIpv6;
                        }
                    }
                    this.currentInterfaces.set(name, networkInterface);
                    if (networkInterface.loopback) {
                        this.loopbackInterfaces.set(name, networkInterface);
                    }
                    (changes !== null && changes !== void 0 ? changes : (changes = [])).push(change);
                }
            }
            else { // new interface was added/started
                this.currentInterfaces.set(name, networkInterface);
                if (networkInterface.loopback) {
                    this.currentInterfaces.set(name, networkInterface);
                }
                (added !== null && added !== void 0 ? added : (added = [])).push(networkInterface);
            }
        }
        // at this point we updated any existing interfaces and added all new interfaces
        // thus if the length of below is not the same interface must have been removed
        // this check ensures that we do not unnecessarily loop twice through our interfaces
        if (this.currentInterfaces.size !== latestInterfaces.size) {
            for (const [name, networkInterface] of this.currentInterfaces) {
                if (!latestInterfaces.has(name)) { // interface was removed
                    this.currentInterfaces.delete(name);
                    this.loopbackInterfaces.delete(name);
                    (removed !== null && removed !== void 0 ? removed : (removed = [])).push(networkInterface);
                }
            }
        }
        if (added || removed || changes) { // emit an event only if anything changed
            const addedString = added ? added.map(iface => iface.name).join(",") : "";
            const removedString = removed ? removed.map(iface => iface.name).join(",") : "";
            const changesString = changes ? changes.map(iface => {
                let string = `{ name: ${iface.name} `;
                if (iface.outdatedIpv4 || iface.updatedIpv4) {
                    string += `, ${iface.outdatedIpv4} -> ${iface.updatedIpv4} `;
                }
                if (iface.outdatedIpv6 || iface.updatedIpv6) {
                    string += `, ${iface.outdatedIpv6} -> ${iface.updatedIpv6} `;
                }
                if (iface.outdatedGloballyRoutableIpv6 || iface.updatedGloballyRoutableIpv6) {
                    string += `, ${iface.outdatedGloballyRoutableIpv6} -> ${iface.updatedGloballyRoutableIpv6} `;
                }
                if (iface.outdatedUniqueLocalIpv6 || iface.updatedUniqueLocalIpv6) {
                    string += `, ${iface.outdatedUniqueLocalIpv6} -> ${iface.updatedUniqueLocalIpv6} `;
                }
                return string + "}";
            }).join(",") : "";
            debug("Detected network changes: added: [%s], removed: [%s], changes: [%s]!", addedString, removedString, changesString);
            this.emit("network-update" /* NetworkManagerEvent.NETWORK_UPDATE */, {
                added: added,
                removed: removed,
                changes: changes,
            });
        }
        this.scheduleNextJob();
    }
    async getCurrentNetworkInterfaces() {
        let names;
        if (this.restrictedInterfaces) {
            names = this.restrictedInterfaces;
            const loopback = NetworkManager.getLoopbackInterface();
            if (!names.includes(loopback)) {
                names.push(loopback);
            }
        }
        else {
            try {
                names = await NetworkManager.getNetworkInterfaceNames();
            }
            catch (error) {
                debug(`WARNING Detecting network interfaces for platform '${os_1.default.platform()}' failed. Trying to assume network interfaces! (${error.message})`);
                // fallback way of gathering network interfaces (remember, there are docker images where the arp command is not installed)
                names = NetworkManager.assumeNetworkInterfaceNames();
            }
        }
        const interfaces = new Map();
        const networkInterfaces = os_1.default.networkInterfaces();
        for (const name of names) {
            const infos = networkInterfaces[name];
            if (!infos) {
                continue;
            }
            let ipv4Info = undefined;
            let ipv6Info = undefined;
            let routableIpv6Info = undefined;
            let uniqueLocalIpv6Info = undefined;
            let internal = false;
            for (const info of infos) {
                if (info.internal) {
                    internal = true;
                }
                // @ts-expect-error Nodejs 18+ uses the number 4 instead of the string "IPv4"
                if ((info.family === "IPv4" || info.family === 4) && !ipv4Info) {
                    ipv4Info = info;
                    // @ts-expect-error Nodejs 18+ uses the number 4 instead of the string "IPv4"
                }
                else if (info.family === "IPv6" || info.family === 6) {
                    if (this.excludeIpv6) {
                        continue;
                    }
                    if (info.scopeid && !ipv6Info) { // we only care about non zero scope (aka link-local ipv6)
                        ipv6Info = info;
                    }
                    else if (info.scopeid === 0) { // global routable ipv6
                        if (info.address.startsWith("fc") || info.address.startsWith("fd")) {
                            if (!uniqueLocalIpv6Info) {
                                uniqueLocalIpv6Info = info;
                            }
                        }
                        else if (!routableIpv6Info) {
                            routableIpv6Info = info;
                        }
                    }
                }
                if (ipv4Info && ipv6Info && routableIpv6Info && uniqueLocalIpv6Info) {
                    break;
                }
            }
            (0, assert_1.default)(ipv4Info || ipv6Info, "Could not find valid addresses for interface '" + name + "'");
            if (this.excludeIpv6Only && !ipv4Info) {
                continue;
            }
            const networkInterface = {
                name: name,
                loopback: internal,
                mac: ((ipv4Info === null || ipv4Info === void 0 ? void 0 : ipv4Info.mac) || (ipv6Info === null || ipv6Info === void 0 ? void 0 : ipv6Info.mac)),
            };
            if (ipv4Info) {
                networkInterface.ipv4 = ipv4Info.address;
                networkInterface.ip4Netmask = ipv4Info.netmask;
                networkInterface.ipv4Netaddress = (0, domain_formatter_1.getNetAddress)(ipv4Info.address, ipv4Info.netmask);
            }
            if (ipv6Info) {
                networkInterface.ipv6 = ipv6Info.address;
                networkInterface.ipv6Netmask = ipv6Info.netmask;
            }
            if (routableIpv6Info) {
                networkInterface.globallyRoutableIpv6 = routableIpv6Info.address;
                networkInterface.globallyRoutableIpv6Netmask = routableIpv6Info.netmask;
            }
            if (uniqueLocalIpv6Info) {
                networkInterface.uniqueLocalIpv6 = uniqueLocalIpv6Info.address;
                networkInterface.uniqueLocalIpv6Netmask = uniqueLocalIpv6Info.netmask;
            }
            interfaces.set(name, networkInterface);
        }
        return interfaces;
    }
    static resolveInterface(address) {
        let interfaceName;
        outer: for (const [name, infoArray] of Object.entries(os_1.default.networkInterfaces())) {
            for (const info of infoArray !== null && infoArray !== void 0 ? infoArray : []) {
                if (info.address === address) {
                    interfaceName = name;
                    break outer; // exit out of both loops
                }
            }
        }
        return interfaceName;
    }
    static async getNetworkInterfaceNames() {
        // this function will always include the loopback interface
        let promise;
        switch (os_1.default.platform()) {
            case "win32":
                promise = NetworkManager.getWindowsNetworkInterfaces();
                break;
            case "linux": {
                promise = NetworkManager.getLinuxNetworkInterfaces();
                break;
            }
            case "darwin":
                promise = NetworkManager.getDarwinNetworkInterfaces();
                break;
            case "freebsd": {
                promise = NetworkManager.getFreeBSDNetworkInterfaces();
                break;
            }
            case "openbsd":
            case "sunos": {
                promise = NetworkManager.getOpenBSD_SUNOS_NetworkInterfaces();
                break;
            }
            default:
                debug("Found unsupported platform %s", os_1.default.platform());
                return Promise.reject(new Error("unsupported platform!"));
        }
        let names;
        try {
            names = await promise;
        }
        catch (error) {
            if (error.message !== NetworkManager.NOTHING_FOUND_MESSAGE) {
                throw error;
            }
            names = [];
        }
        const loopback = NetworkManager.getLoopbackInterface();
        if (!names.includes(loopback)) {
            names.unshift(loopback);
        }
        return promise;
    }
    static assumeNetworkInterfaceNames() {
        // this method is a fallback trying to calculate network related interfaces in an platform independent way
        const names = [];
        Object.entries(os_1.default.networkInterfaces()).forEach(([name, infos]) => {
            for (const info of infos !== null && infos !== void 0 ? infos : []) {
                // we add the loopback interface or interfaces which got a unique (global or local) ipv6 address
                // we currently don't just add all interfaces with ipv4 addresses as are often interfaces like VPNs, container/vms related
                // unique global or unique local ipv6 addresses give an indication that we are truly connected to "the Internet"
                // as something like SLAAC must be going on
                // in the end
                // @ts-expect-error Nodejs 18+ uses the number 4/6 instead of the string "IPv4"/"IPv6"
                if (info.internal || (info.family === "IPv4" || info.family === 4) || (info.family === "IPv6" || info.family === 6) && info.scopeid === 0) {
                    if (!names.includes(name)) {
                        names.push(name);
                    }
                    break;
                }
            }
        });
        return names;
    }
    static getLoopbackInterface() {
        for (const [name, infos] of Object.entries(os_1.default.networkInterfaces())) {
            for (const info of infos !== null && infos !== void 0 ? infos : []) {
                if (info.internal) {
                    return name;
                }
            }
        }
        throw new Error("Could not detect loopback interface!");
    }
    static getWindowsNetworkInterfaces() {
        // does not return loopback interface
        return new Promise((resolve, reject) => {
            child_process_1.default.exec("arp -a | findstr /C:\"---\"", (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const lines = stdout.split(os_1.default.EOL);
                const addresses = [];
                for (let i = 0; i < lines.length - 1; i++) {
                    const line = lines[i].trim().split(" ");
                    if (line[line.length - 3]) {
                        addresses.push(line[line.length - 3]);
                    }
                    else {
                        debug(`WINDOWS: Failed to read interface name from line ${i}: '${lines[i]}'`);
                    }
                }
                const names = [];
                for (const address of addresses) {
                    const name = NetworkManager.resolveInterface(address);
                    if (name) {
                        if (!names.includes(name)) {
                            names.push(name);
                        }
                    }
                    else {
                        debug(`WINDOWS: Couldn't resolve to an interface name from '${address}'`);
                    }
                }
                if (names.length) {
                    resolve(names);
                }
                else {
                    reject(new Error(NetworkManager.NOTHING_FOUND_MESSAGE));
                }
            });
        });
    }
    static getDarwinNetworkInterfaces() {
        /*
         * Previous efforts used the routing table to get all relevant network interfaces.
         * Particularly using "netstat -r -f inet -n".
         * First attempt was to use the "default" interface to the 0.0.0.0 catch all route using "route get 0.0.0.0".
         * Though this fails when the router isn't connected to the internet, thus no "internet route" exists.
         */
        // does not return loopback interface
        return new Promise((resolve, reject) => {
            // for ipv6 "ndp -a -n |grep -v permanent" with filtering for "expired"
            child_process_1.default.exec("arp -a -n -l", async (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const lines = stdout.split(os_1.default.EOL);
                const names = [];
                for (let i = 1; i < lines.length - 1; i++) {
                    const interfaceName = lines[i].trim().split(NetworkManager.SPACE_PATTERN)[4];
                    if (!interfaceName) {
                        debug(`DARWIN: Failed to read interface name from line ${i}: '${lines[i]}'`);
                        continue;
                    }
                    if (!names.includes(interfaceName)) {
                        names.push(interfaceName);
                    }
                }
                const promises = [];
                for (const name of names) {
                    const promise = NetworkManager.getDarwinWifiNetworkState(name).then(state => {
                        if (state !== 1 /* WifiState.NOT_A_WIFI_INTERFACE */ && state !== 3 /* WifiState.CONNECTED */) {
                            // removing wifi networks which are not connected to any networks
                            const index = names.indexOf(name);
                            if (index !== -1) {
                                names.splice(index, 1);
                            }
                        }
                    });
                    promises.push(promise);
                }
                await Promise.all(promises);
                if (names.length) {
                    resolve(names);
                }
                else {
                    reject(new Error(NetworkManager.NOTHING_FOUND_MESSAGE));
                }
            });
        });
    }
    static getLinuxNetworkInterfaces() {
        // does not return loopback interface
        return new Promise((resolve, reject) => {
            // we use "ip neigh" here instead of the aliases like "ip neighbour" or "ip neighbor"
            // as those were only added like 5 years ago https://github.com/shemminger/iproute2/commit/ede723964a065992bf9d0dbe3f780e65ca917872
            child_process_1.default.exec("ip neigh show", (error, stdout) => {
                if (error) {
                    if (error.message.includes("ip: not found")) {
                        debug("LINUX: ip was not found on the system. Falling back to assuming network interfaces!");
                        resolve(NetworkManager.assumeNetworkInterfaceNames());
                        return;
                    }
                    reject(error);
                    return;
                }
                const lines = stdout.split(os_1.default.EOL);
                const names = [];
                for (let i = 0; i < lines.length - 1; i++) {
                    const parts = lines[i].trim().split(NetworkManager.SPACE_PATTERN);
                    let devIndex = 0;
                    for (; devIndex < parts.length; devIndex++) {
                        if (parts[devIndex] === "dev") {
                            // the next index marks the interface name
                            break;
                        }
                    }
                    if (devIndex >= parts.length) {
                        debug(`LINUX: Out of bounds when reading interface name from line ${i}: '${lines[i]}'`);
                        continue;
                    }
                    const interfaceName = parts[devIndex + 1];
                    if (!interfaceName) {
                        debug(`LINUX: Failed to read interface name from line ${i}: '${lines[i]}'`);
                        continue;
                    }
                    if (!names.includes(interfaceName)) {
                        names.push(interfaceName);
                    }
                }
                if (names.length) {
                    resolve(names);
                }
                else {
                    reject(new Error(NetworkManager.NOTHING_FOUND_MESSAGE));
                }
            });
        });
    }
    static getFreeBSDNetworkInterfaces() {
        // does not return loopback interface
        return new Promise((resolve, reject) => {
            child_process_1.default.exec("arp -a -n", (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const lines = stdout.split(os_1.default.EOL);
                const names = [];
                for (let i = 0; i < lines.length - 1; i++) {
                    const interfaceName = lines[i].trim().split(NetworkManager.SPACE_PATTERN)[5];
                    if (!interfaceName) {
                        debug(`FreeBSD: Failed to read interface name from line ${i}: '${lines[i]}'`);
                        continue;
                    }
                    if (!names.includes(interfaceName)) {
                        names.push(interfaceName);
                    }
                }
                if (names.length) {
                    resolve(names);
                }
                else {
                    reject(new Error(NetworkManager.NOTHING_FOUND_MESSAGE));
                }
            });
        });
    }
    static getOpenBSD_SUNOS_NetworkInterfaces() {
        // does not return loopback interface
        return new Promise((resolve, reject) => {
            // for ipv6 something like "ndp -a -n | grep R" (grep for reachable; maybe exclude permanent?)
            child_process_1.default.exec("arp -a -n", (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                const interfaceArrayOffset = os_1.default.platform() === "sunos" ? 0 : 2;
                const lines = stdout.split(os_1.default.EOL);
                const names = [];
                for (let i = 1; i < lines.length - 1; i++) {
                    const interfaceName = lines[i].trim().split(NetworkManager.SPACE_PATTERN)[interfaceArrayOffset];
                    if (!interfaceName) {
                        debug(`${os_1.default.platform()}: Failed to read interface name from line ${i}: '${lines[i]}'`);
                        continue;
                    }
                    if (!names.includes(interfaceName)) {
                        names.push(interfaceName);
                    }
                }
                if (names.length) {
                    resolve(names);
                }
                else {
                    reject(new Error(NetworkManager.NOTHING_FOUND_MESSAGE));
                }
            });
        });
    }
    static getDarwinWifiNetworkState(name) {
        return new Promise(resolve => {
            /*
               * networksetup outputs the following in the listed scenarios:
               *
               * executed for an interface which is not a Wi-Fi interface:
               * "<name> is not a Wi-Fi interface.
               * Error: Error obtaining wireless information."
               *
               * executed for a turned off Wi-Fi interface:
               * "You are not associated with an AirPort network.
               * Wi-Fi power is currently off."
               *
               * executed for a turned on Wi-Fi interface which is not connected:
               * "You are not associated with an AirPort network."
               *
               * executed for a connected Wi-Fi interface:
               * "Current Wi-Fi Network: <network name>"
               *
               * Other messages handled here.
               * "All Wi-Fi network services are disabled": encountered on macOS VM machines
               */
            child_process_1.default.exec("networksetup -getairportnetwork " + name, (error, stdout) => {
                if (error) {
                    if (stdout.includes("not a Wi-Fi interface")) {
                        resolve(1 /* WifiState.NOT_A_WIFI_INTERFACE */);
                        return;
                    }
                    console.log(`CIAO WARN: While checking networksetup for ${name} encountered an error (${error.message}) with output: ${stdout.replace(os_1.default.EOL, "; ")}`);
                    resolve(0 /* WifiState.UNDEFINED */);
                    return;
                }
                let wifiState = 0 /* WifiState.UNDEFINED */;
                if (stdout.includes("not a Wi-Fi interface")) {
                    wifiState = 1 /* WifiState.NOT_A_WIFI_INTERFACE */;
                }
                else if (stdout.includes("Current Wi-Fi Network")) {
                    wifiState = 3 /* WifiState.CONNECTED */;
                }
                else if (stdout.includes("not associated")) {
                    wifiState = 2 /* WifiState.NOT_ASSOCIATED */;
                }
                else if (stdout.includes("All Wi-Fi network services are disabled")) {
                    // typically encountered on a macOS VM or something not having a WiFi card
                    wifiState = 1 /* WifiState.NOT_A_WIFI_INTERFACE */;
                }
                else {
                    console.log(`CIAO WARN: While checking networksetup for ${name} encountered an unknown output: ${stdout.replace(os_1.default.EOL, "; ")}`);
                }
                resolve(wifiState);
            });
        });
    }
}
exports.NetworkManager = NetworkManager;
NetworkManager.SPACE_PATTERN = /\s+/g;
NetworkManager.NOTHING_FOUND_MESSAGE = "no interfaces found";
NetworkManager.POLLING_TIME = 15 * 1000; // 15 seconds
//# sourceMappingURL=NetworkManager.js.map