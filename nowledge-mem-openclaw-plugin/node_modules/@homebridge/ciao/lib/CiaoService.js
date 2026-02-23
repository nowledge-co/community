"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CiaoService = exports.InternalServiceEvent = exports.ServiceEvent = exports.ServiceState = exports.ServiceType = void 0;
const tslib_1 = require("tslib");
/* eslint-disable @typescript-eslint/no-unsafe-declaration-merging */
const assert_1 = tslib_1.__importDefault(require("assert"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const events_1 = require("events");
const net_1 = tslib_1.__importDefault(require("net"));
const AAAARecord_1 = require("./coder/records/AAAARecord");
const ARecord_1 = require("./coder/records/ARecord");
const NSECRecord_1 = require("./coder/records/NSECRecord");
const PTRRecord_1 = require("./coder/records/PTRRecord");
const SRVRecord_1 = require("./coder/records/SRVRecord");
const TXTRecord_1 = require("./coder/records/TXTRecord");
const ResourceRecord_1 = require("./coder/ResourceRecord");
const index_1 = require("./index");
const NetworkManager_1 = require("./NetworkManager");
const dns_equal_1 = require("./util/dns-equal");
const domainFormatter = tslib_1.__importStar(require("./util/domain-formatter"));
const domain_formatter_1 = require("./util/domain-formatter");
const debug = (0, debug_1.default)("ciao:CiaoService");
const numberedServiceNamePattern = /^(.*) \((\d+)\)$/; // matches a name lik "My Service (2)"
const numberedHostnamePattern = /^(.*)-\((\d+)\)(\.\w{2,}.)$/; // matches a hostname like "My-Computer-(2).local."
/**
 * This enum defines some commonly used service types.
 * This is also referred to as service name (as of RFC 6763).
 * A service name must not be longer than 15 characters (RFC 6763 7.2).
 */
var ServiceType;
(function (ServiceType) {
    // noinspection JSUnusedGlobalSymbols
    ServiceType["AIRDROP"] = "airdrop";
    ServiceType["AIRPLAY"] = "airplay";
    ServiceType["AIRPORT"] = "airport";
    ServiceType["COMPANION_LINK"] = "companion-link";
    ServiceType["DACP"] = "dacp";
    ServiceType["HAP"] = "hap";
    ServiceType["HOMEKIT"] = "homekit";
    ServiceType["HTTP"] = "http";
    ServiceType["HTTP_ALT"] = "http_alt";
    ServiceType["IPP"] = "ipp";
    ServiceType["IPPS"] = "ipps";
    ServiceType["RAOP"] = "raop";
    ServiceType["scanner"] = "scanner";
    ServiceType["TOUCH_ABLE"] = "touch-able";
    ServiceType["DNS_SD"] = "dns-sd";
    ServiceType["PRINTER"] = "printer";
})(ServiceType || (exports.ServiceType = ServiceType = {}));
/**
 * @private
 */
var ServiceState;
(function (ServiceState) {
    ServiceState["UNANNOUNCED"] = "unannounced";
    ServiceState["PROBING"] = "probing";
    ServiceState["PROBED"] = "probed";
    ServiceState["ANNOUNCING"] = "announcing";
    ServiceState["ANNOUNCED"] = "announced";
})(ServiceState || (exports.ServiceState = ServiceState = {}));
/**
 * Events thrown by a CiaoService
 */
var ServiceEvent;
(function (ServiceEvent) {
    /**
     * Event is called when the Prober identifies that the name for the service is already used
     * and thus resolve the name conflict by adjusting the name (e.g. adding '(2)' to the name).
     * This change must be persisted and thus a listener must hook up to this event
     * in order for the name to be persisted.
     */
    ServiceEvent["NAME_CHANGED"] = "name-change";
    /**
     * Event is called when the Prober identifies that the hostname for the service is already used
     * and thus resolve the name conflict by adjusting the hostname (e.g. adding '(2)' to the hostname).
     * The name change must be persisted. As the hostname is an optional parameter, it is derived
     * from the service name if not supplied.
     * If you supply a custom hostname (not automatically derived from the service name) you must
     * hook up a listener to this event in order for the hostname to be persisted.
     */
    ServiceEvent["HOSTNAME_CHANGED"] = "hostname-change";
})(ServiceEvent || (exports.ServiceEvent = ServiceEvent = {}));
/**
 * Events thrown by a CiaoService, internal use only!
 * @private
 */
var InternalServiceEvent;
(function (InternalServiceEvent) {
    InternalServiceEvent["PUBLISH"] = "publish";
    InternalServiceEvent["UNPUBLISH"] = "unpublish";
    InternalServiceEvent["REPUBLISH"] = "republish";
    InternalServiceEvent["RECORD_UPDATE"] = "records-update";
    InternalServiceEvent["RECORD_UPDATE_ON_INTERFACE"] = "records-update-interface";
})(InternalServiceEvent || (exports.InternalServiceEvent = InternalServiceEvent = {}));
/**
 * The CiaoService class represents a service which can be advertised on the network.
 *
 * A service is identified by its fully qualified domain name (FQDN), which consist of
 * the service name, the service type, the protocol and the service domain (.local by default).
 *
 * The service defines a hostname and a port where the advertised service can be reached.
 *
 * Additionally, a TXT record can be published, which can contain information (in form of key-value pairs),
 * which might be useful to a querier.
 *
 * A CiaoService class is always bound to a {@link Responder} and can be created using the
 * {@link Responder.createService} method in the Responder class.
 * Once the instance is created, {@link advertise} can be called to announce the service on the network.
 */
class CiaoService extends events_1.EventEmitter {
    /**
     * Constructs a new service. Please use {@link Responder.createService} to create new service.
     * When calling the constructor a callee must listen to certain events in order to provide
     * correct functionality.
     * @private used by the Responder instance to create a new service
     */
    constructor(networkManager, options) {
        super();
        /**
         * this field is entirely controlled by the Responder class
         * @private use by the Responder to set the current service state
         */
        this.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
        this.destroyed = false;
        (0, assert_1.default)(networkManager, "networkManager is required");
        (0, assert_1.default)(options, "parameters options is required");
        (0, assert_1.default)(options.name, "service options parameter 'name' is required");
        (0, assert_1.default)(options.type, "service options parameter 'type' is required");
        (0, assert_1.default)(options.type.length <= 15, "service options parameter 'type' must not be longer than 15 characters");
        this.networkManager = networkManager;
        this.name = options.name;
        this.type = options.type;
        this.subTypes = options.subtypes;
        this.protocol = options.protocol || "tcp" /* Protocol.TCP */;
        this.serviceDomain = options.domain || "local";
        this.fqdn = this.formatFQDN();
        this.loweredFqdn = (0, dns_equal_1.dnsLowerCase)(this.fqdn);
        this.typePTR = domainFormatter.stringify({
            type: this.type,
            protocol: this.protocol,
            domain: this.serviceDomain,
        });
        this.loweredTypePTR = (0, dns_equal_1.dnsLowerCase)(this.typePTR);
        if (this.subTypes) {
            this.subTypePTRs = this.subTypes.map(subtype => domainFormatter.stringify({
                subtype: subtype,
                type: this.type,
                protocol: this.protocol,
                domain: this.serviceDomain,
            })).map(dns_equal_1.dnsLowerCase);
        }
        this.hostname = domainFormatter.formatHostname(options.hostname || this.name, this.serviceDomain)
            .replace(/ /g, "-"); // replacing all spaces with dashes in the hostname
        this.loweredHostname = (0, dns_equal_1.dnsLowerCase)(this.hostname);
        this.port = options.port;
        if (options.restrictedAddresses) {
            (0, assert_1.default)(options.restrictedAddresses.length, "The service property 'restrictedAddresses' cannot be an empty array!");
            this.restrictedAddresses = new Map();
            for (const entry of options.restrictedAddresses) {
                if (net_1.default.isIP(entry)) {
                    if (entry === "0.0.0.0" || entry === "::") {
                        throw new Error(`[${this.fqdn}] Unspecified ip address (${entry}) cannot be used to restrict on to!`);
                    }
                    const interfaceName = NetworkManager_1.NetworkManager.resolveInterface(entry);
                    if (!interfaceName) {
                        throw new Error(`[${this.fqdn}] Could not restrict service to address ${entry} as we could not resolve it to an interface name!`);
                    }
                    const current = this.restrictedAddresses.get(interfaceName);
                    if (current) {
                        // empty interface signals "catch all" was already configured for this
                        if (current.length && !current.includes(entry)) {
                            current.push(entry);
                        }
                    }
                    else {
                        this.restrictedAddresses.set(interfaceName, [entry]);
                    }
                }
                else {
                    this.restrictedAddresses.set(entry, []); // empty array signals "use all addresses for interface"
                }
            }
        }
        this.disableIpv6 = options.disabledIpv6;
        this.txt = options.txt ? CiaoService.txtBuffersFromRecord(options.txt) : [];
        // checks if hostname or name are already numbered and adjusts the numbers if necessary
        this.incrementName(true);
    }
    /**
     * This method start the advertising process of the service:
     *  - The service name (and hostname) will be probed unique on all interfaces (as defined in RFC 6762 8.1).
     *  - Once probed unique the service will be announced (as defined in RFC 6762 8.3).
     *
     *  The returned promise resolves once the last announcement packet was successfully sent on all network interfaces.
     *  The promise might be rejected caused by one of the following reasons:
     *    - A probe query could not be sent successfully
     *    - Prober could not find a unique service name while trying for a minute (timeout)
     *    - One of the announcement packets could not be sent successfully
     */
    advertise() {
        (0, assert_1.default)(!this.destroyed, "Cannot publish destroyed service!");
        (0, assert_1.default)(this.port, "Service port must be defined before advertising the service on the network!");
        if (this.listeners("name-change" /* ServiceEvent.NAME_CHANGED */).length === 0) {
            debug("[%s] WARN: No listeners found for a potential name change on the 'name-change' event!", this.name);
        }
        return new Promise((resolve, reject) => {
            this.emit("publish" /* InternalServiceEvent.PUBLISH */, error => error ? reject(error) : resolve());
        });
    }
    /**
     * This method will remove the advertisement for the service on all connected network interfaces.
     * If the service is still in the Probing state, probing will simply be cancelled.
     *
     * @returns Promise will resolve once the last goodbye packet was sent out
     */
    end() {
        (0, assert_1.default)(!this.destroyed, "Cannot end destroyed service!");
        if (this.serviceState === "unannounced" /* ServiceState.UNANNOUNCED */) {
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            this.emit("unpublish" /* InternalServiceEvent.UNPUBLISH */, error => error ? reject(error) : resolve());
        });
    }
    /**
     * This method must be called if you want to free the memory used by this service.
     * The service instance is not usable anymore after this call.
     *
     * If the service is still announced, the service will first be removed
     * from the network by calling {@link end}.
     *
     * @returns
     */
    async destroy() {
        await this.end();
        this.destroyed = true;
        this.removeAllListeners();
    }
    /**
     * @returns The fully qualified domain name of the service, used to identify the service.
     */
    getFQDN() {
        return this.fqdn;
    }
    /**
     * @returns The service type pointer.
     */
    getTypePTR() {
        return this.typePTR;
    }
    /**
     * @returns Array of subtype pointers (undefined if no subtypes are specified).
     */
    getLowerCasedSubtypePTRs() {
        return this.subTypePTRs;
    }
    /**
     * @returns The current hostname of the service.
     */
    getHostname() {
        return this.hostname;
    }
    /**
     * @returns The port the service is advertising for.
     * {@code -1} is returned when the port is not yet set.
     */
    getPort() {
        return this.port || -1;
    }
    /**
     * @returns The current TXT of the service represented as Buffer array.
     * @private There is not need for this to be public API
     */
    getTXT() {
        return this.txt;
    }
    /**
     * @private used for internal comparison {@link dnsLowerCase}
     */
    getLowerCasedFQDN() {
        return this.loweredFqdn;
    }
    /**
     * @private used for internal comparison {@link dnsLowerCase}
     */
    getLowerCasedTypePTR() {
        return this.loweredTypePTR;
    }
    /**
     * @private used for internal comparison {@link dnsLowerCase}
     */
    getLowerCasedHostname() {
        return this.loweredHostname;
    }
    /**
     * Sets or updates the txt of the service.
     *
     * @param {ServiceTxt} txt - The updated txt record.
     * @param {boolean} silent - If set to true no announcement is sent for the updated record.
     */
    updateTxt(txt, silent = false) {
        (0, assert_1.default)(!this.destroyed, "Cannot update destroyed service!");
        (0, assert_1.default)(txt, "txt cannot be undefined");
        this.txt = CiaoService.txtBuffersFromRecord(txt);
        debug("[%s] Updating txt record%s...", this.name, silent ? " silently" : "");
        if (this.serviceState === "announcing" /* ServiceState.ANNOUNCING */) {
            this.rebuildServiceRecords();
            if (silent) {
                return;
            }
            if (this.currentAnnouncer.hasSentLastAnnouncement()) {
                // if the announcer hasn't sent the last announcement, the above call of rebuildServiceRecords will
                // result in updated records on the next announcement. Otherwise, we still need to announce the updated records
                this.currentAnnouncer.awaitAnnouncement().then(() => {
                    this.queueTxtUpdate();
                });
            }
        }
        else if (this.serviceState === "announced" /* ServiceState.ANNOUNCED */) {
            this.rebuildServiceRecords();
            if (silent) {
                return;
            }
            this.queueTxtUpdate();
        }
    }
    queueTxtUpdate() {
        if (this.txtTimer) {
            return;
        }
        else {
            // we debounce txt updates, otherwise if api users would spam txt updates, we would receive the txt record
            // while we already update our txt to the next call, thus causing a conflict being detected.
            // We would then continue with Probing (to ensure uniqueness) and could then receive following spammed updates as conflicts,
            // and we would change our name without it being necessary
            this.txtTimer = setTimeout(() => {
                this.txtTimer = undefined;
                if (this.serviceState !== "announced" /* ServiceState.ANNOUNCED */) { // stuff changed in the last 50 milliseconds
                    return;
                }
                this.emit("records-update" /* InternalServiceEvent.RECORD_UPDATE */, {
                    answers: [this.txtRecord()],
                    additionals: [this.serviceNSECRecord()],
                });
            }, 50);
        }
    }
    /**
     * Sets or updates the port of the service.
     * A new port number can only be set when the service is still UNANNOUNCED.
     * Otherwise, an assertion error will be thrown.
     *
     * @param {number} port - The new port number.
     */
    updatePort(port) {
        (0, assert_1.default)(this.serviceState === "unannounced" /* ServiceState.UNANNOUNCED */, "Port number cannot be changed when service is already advertised!");
        this.port = port;
    }
    /**
     * This method updates the name of the service.
     * @param name - The new service name.
     * @private Currently not public API and only used for bonjour conformance testing.
     */
    updateName(name) {
        if (this.serviceState === "unannounced" /* ServiceState.UNANNOUNCED */) {
            this.name = name;
            this.fqdn = this.formatFQDN();
            this.loweredFqdn = (0, dns_equal_1.dnsLowerCase)(this.fqdn);
            return Promise.resolve();
        }
        else {
            return this.end() // send goodbye packets for the current name
                .then(() => {
                this.name = name;
                this.fqdn = this.formatFQDN();
                this.loweredFqdn = (0, dns_equal_1.dnsLowerCase)(this.fqdn);
                // service records are going to be rebuilt on the 'advertise' step
                return this.advertise();
            });
        }
    }
    static txtBuffersFromRecord(txt) {
        const result = [];
        Object.entries(txt).forEach(([key, value]) => {
            const entry = key + "=" + value;
            result.push(Buffer.from(entry));
        });
        return result;
    }
    /**
     * @param networkUpdate
     * @private
     */
    handleNetworkInterfaceUpdate(networkUpdate) {
        (0, assert_1.default)(!this.destroyed, "Cannot update network of destroyed service!");
        // this will currently only be called when service is ANNOUNCED or in ANNOUNCING state
        if (this.serviceState !== "announced" /* ServiceState.ANNOUNCED */) {
            if (this.serviceState === "announcing" /* ServiceState.ANNOUNCING */) {
                this.rebuildServiceRecords();
                if (this.currentAnnouncer.hasSentLastAnnouncement()) {
                    // if the announcer hasn't sent the last announcement, the above call of rebuildServiceRecords will
                    // result in updated records on the next announcement. Otherwise, we still need to announce the updated records
                    this.currentAnnouncer.awaitAnnouncement().then(() => {
                        this.handleNetworkInterfaceUpdate(networkUpdate);
                    });
                }
            }
            return; // service records are rebuilt short before the 'announce' step
        }
        // we don't care about removed interfaces. We can't send goodbye records on a non-existing interface
        this.rebuildServiceRecords();
        // records for a removed interface are now no longer present after the call above
        // records for a new interface got now built by the call above
        /* logic disabled for now
        if (networkUpdate.changes) {
          // we could optimize this and don't send the announcement of records if we have also added a new interface
          // Though probing will take at least 750 ms and thus sending it out immediately will get the information out faster.
    
          for (const change of networkUpdate.changes) {
            if (!this.advertisesOnInterface(change.name, true)) {
              continue;
            }
    
            let restrictedAddresses: IPAddress[] | undefined = this.restrictedAddresses? this.restrictedAddresses.get(change.name): undefined;
            if (restrictedAddresses && restrictedAddresses.length === 0) {
              restrictedAddresses = undefined;
            }
            const records: ResourceRecord[] = [];
    
            if (change.outdatedIpv4 && (!restrictedAddresses || restrictedAddresses.includes(change.outdatedIpv4))) {
              records.push(new ARecord(this.hostname, change.outdatedIpv4, true, 0));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.outdatedIpv4), this.hostname, false, 0));
            }
            if (change.outdatedIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(change.outdatedIpv6))) {
              records.push(new AAAARecord(this.hostname, change.outdatedIpv6, true, 0));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.outdatedIpv6), this.hostname, false, 0));
            }
            if (change.outdatedGloballyRoutableIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(change.outdatedGloballyRoutableIpv6))) {
              records.push(new AAAARecord(this.hostname, change.outdatedGloballyRoutableIpv6, true, 0));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.outdatedGloballyRoutableIpv6), this.hostname, false, 0));
            }
            if (change.outdatedUniqueLocalIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(change.outdatedUniqueLocalIpv6))) {
              records.push(new AAAARecord(this.hostname, change.outdatedUniqueLocalIpv6, true, 0));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.outdatedUniqueLocalIpv6), this.hostname, false, 0));
            }
    
            if (change.updatedIpv4 && (!restrictedAddresses || restrictedAddresses.includes(change.updatedIpv4))) {
              records.push(new ARecord(this.hostname, change.updatedIpv4, true));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.updatedIpv4), this.hostname));
            }
            if (change.updatedIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(change.updatedIpv6))) {
              records.push(new AAAARecord(this.hostname, change.updatedIpv6, true));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.updatedIpv6), this.hostname));
            }
            if (change.updatedGloballyRoutableIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(change.updatedGloballyRoutableIpv6))) {
              records.push(new AAAARecord(this.hostname, change.updatedGloballyRoutableIpv6, true));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.updatedGloballyRoutableIpv6), this.hostname));
            }
            if (change.updatedUniqueLocalIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(change.updatedUniqueLocalIpv6))) {
              records.push(new AAAARecord(this.hostname, change.updatedUniqueLocalIpv6, true));
              // records.push(new PTRRecord(formatReverseAddressPTRName(change.updatedUniqueLocalIpv6), this.hostname));
            }
    
            this.emit(InternalServiceEvent.RECORD_UPDATE_ON_INTERFACE, change.name, records);
          }
        }
        */
        if (networkUpdate.added || networkUpdate.changes) {
            // a new network interface got added. We must return into probing state,
            // as we don't know if we still own uniqueness for our service name on the new network.
            // To make things easy and keep the SAME name on all networks, we probe on ALL interfaces.
            // at this moment the new socket won't be bound. Though probing steps are delayed,
            // thus, when sending the first request, the socket will be bound, and we don't need to wait here
            this.emit("republish" /* InternalServiceEvent.REPUBLISH */, error => {
                if (error) {
                    console.log("FATAL Error occurred trying to re-announce service " + this.fqdn + "! We can't recover from this!");
                    console.log(error.stack);
                    process.exit(1); // we have a service which should be announced, though we failed to re-announce.
                    // if this should ever happen in reality, whe might want to introduce a more sophisticated recovery
                    // for situations where it makes sense
                }
            });
        }
    }
    /**
     * This method is called by the Prober when encountering a conflict on the network.
     * It advises the service to change its name, like incrementing a number appended to the name.
     * So "My Service" will become "My Service (2)", and "My Service (2)" would become "My Service (3)"
     * @private must only be called by the {@link Prober}
     */
    incrementName(nameCheckOnly) {
        if (this.serviceState !== "unannounced" /* ServiceState.UNANNOUNCED */) {
            throw new Error("Service name can only be incremented when in state UNANNOUNCED!");
        }
        const oldName = this.name;
        const oldHostname = this.hostname;
        let nameBase;
        let nameNumber;
        let hostnameBase;
        let hostnameTLD;
        let hostnameNumber;
        const nameMatcher = this.name.match(numberedServiceNamePattern);
        if (nameMatcher) { // if it matched. Extract the current nameNumber
            nameBase = nameMatcher[1];
            nameNumber = parseInt(nameMatcher[2]);
            (0, assert_1.default)(nameNumber, `Failed to extract name number from ${this.name}. Resulted in ${nameNumber}`);
        }
        else {
            nameBase = this.name;
            nameNumber = 1;
        }
        const hostnameMatcher = this.hostname.match(numberedHostnamePattern);
        if (hostnameMatcher) { // if it matched. Extract the current nameNumber
            hostnameBase = hostnameMatcher[1];
            hostnameTLD = hostnameMatcher[3];
            hostnameNumber = parseInt(hostnameMatcher[2]);
            (0, assert_1.default)(hostnameNumber, `Failed to extract hostname number from ${this.hostname}. Resulted in ${hostnameNumber}`);
        }
        else {
            // we need to substring, to not match the root label "."
            const lastDot = this.hostname.substring(0, this.hostname.length - 1).lastIndexOf(".");
            hostnameBase = this.hostname.slice(0, lastDot);
            hostnameTLD = this.hostname.slice(lastDot);
            hostnameNumber = 1;
        }
        if (!nameCheckOnly) {
            // increment the numbers
            nameNumber++;
            hostnameNumber++;
        }
        const newNumber = Math.max(nameNumber, hostnameNumber);
        // reassemble the name
        this.name = newNumber === 1 ? nameBase : `${nameBase} (${newNumber})`;
        this.hostname = newNumber === 1 ? `${hostnameBase}${hostnameTLD}` : `${hostnameBase}-(${newNumber})${hostnameTLD}`;
        this.loweredHostname = (0, dns_equal_1.dnsLowerCase)(this.hostname);
        this.fqdn = this.formatFQDN(); // update the fqdn
        this.loweredFqdn = (0, dns_equal_1.dnsLowerCase)(this.fqdn);
        // we must inform the user that the names changed, so the new names can be persisted
        // This is done after the Probing finish, as multiple name changes could happen in one probing session
        // It is the responsibility of the Prober to call the informAboutNameUpdates function
        if (this.name !== oldName || this.hostname !== oldHostname) {
            debug("[%s] Service changed name '%s' -> '%s', '%s' -> '%s'", this.name, oldName, this.name, oldHostname, this.hostname);
        }
        if (!nameCheckOnly) {
            this.rebuildServiceRecords(); // rebuild all services
        }
    }
    /**
     * @private called by the Prober once finished with probing to signal a (or more)
     *   name change(s) happened {@see incrementName}.
     */
    informAboutNameUpdates() {
        // we trust the prober that this function is only called when the name was actually changed
        const nameCalled = this.emit("name-change" /* ServiceEvent.NAME_CHANGED */, this.name);
        const hostnameCalled = this.emit("hostname-change" /* ServiceEvent.HOSTNAME_CHANGED */, domainFormatter.removeTLD(this.hostname));
        // at least one event should be listened to. We can figure out the number from one or another
        if (!nameCalled && !hostnameCalled) {
            console.warn(`CIAO: [${this.name}] Service changed name but nobody was listening on the 'name-change' event!`);
        }
    }
    formatFQDN() {
        if (this.serviceState !== "unannounced" /* ServiceState.UNANNOUNCED */) {
            throw new Error("Name can't be changed after service was already announced!");
        }
        const fqdn = domainFormatter.stringify({
            name: this.name,
            type: this.type,
            protocol: this.protocol,
            domain: this.serviceDomain,
        });
        (0, assert_1.default)(fqdn.length <= 255, "A fully qualified domain name cannot be longer than 255 characters");
        return fqdn;
    }
    /**
     * @private called once the service data/state is updated and the records should be updated with the new data
     */
    rebuildServiceRecords() {
        (0, assert_1.default)(this.port, "port must be set before building records");
        debug("[%s] Rebuilding service records...", this.name);
        const aRecordMap = {};
        const aaaaRecordMap = {};
        const aaaaRoutableRecordMap = {};
        const aaaaUniqueLocalRecordMap = {};
        const reverseAddressMap = {};
        let subtypePTRs = undefined;
        for (const [name, networkInterface] of this.networkManager.getInterfaceMap()) {
            if (!this.advertisesOnInterface(name, true)) {
                continue;
            }
            let restrictedAddresses = this.restrictedAddresses ? this.restrictedAddresses.get(name) : undefined;
            if (restrictedAddresses && restrictedAddresses.length === 0) {
                restrictedAddresses = undefined;
            }
            if (networkInterface.ipv4 && (!restrictedAddresses || restrictedAddresses.includes(networkInterface.ipv4))) {
                aRecordMap[name] = new ARecord_1.ARecord(this.hostname, networkInterface.ipv4, true);
                reverseAddressMap[networkInterface.ipv4] = new PTRRecord_1.PTRRecord((0, domain_formatter_1.formatReverseAddressPTRName)(networkInterface.ipv4), this.hostname);
            }
            if (networkInterface.ipv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(networkInterface.ipv6))) {
                aaaaRecordMap[name] = new AAAARecord_1.AAAARecord(this.hostname, networkInterface.ipv6, true);
                reverseAddressMap[networkInterface.ipv6] = new PTRRecord_1.PTRRecord((0, domain_formatter_1.formatReverseAddressPTRName)(networkInterface.ipv6), this.hostname);
            }
            if (networkInterface.globallyRoutableIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(networkInterface.globallyRoutableIpv6))) {
                aaaaRoutableRecordMap[name] = new AAAARecord_1.AAAARecord(this.hostname, networkInterface.globallyRoutableIpv6, true);
                reverseAddressMap[networkInterface.globallyRoutableIpv6] = new PTRRecord_1.PTRRecord((0, domain_formatter_1.formatReverseAddressPTRName)(networkInterface.globallyRoutableIpv6), this.hostname);
            }
            if (networkInterface.uniqueLocalIpv6 && !this.disableIpv6 && (!restrictedAddresses || restrictedAddresses.includes(networkInterface.uniqueLocalIpv6))) {
                aaaaUniqueLocalRecordMap[name] = new AAAARecord_1.AAAARecord(this.hostname, networkInterface.uniqueLocalIpv6, true);
                reverseAddressMap[networkInterface.uniqueLocalIpv6] = new PTRRecord_1.PTRRecord((0, domain_formatter_1.formatReverseAddressPTRName)(networkInterface.uniqueLocalIpv6), this.hostname);
            }
        }
        if (this.subTypePTRs) {
            subtypePTRs = [];
            for (const ptr of this.subTypePTRs) {
                subtypePTRs.push(new PTRRecord_1.PTRRecord(ptr, this.fqdn));
            }
        }
        this.serviceRecords = {
            ptr: new PTRRecord_1.PTRRecord(this.typePTR, this.fqdn),
            subtypePTRs: subtypePTRs, // possibly undefined
            metaQueryPtr: new PTRRecord_1.PTRRecord(index_1.Responder.SERVICE_TYPE_ENUMERATION_NAME, this.typePTR),
            srv: new SRVRecord_1.SRVRecord(this.fqdn, this.hostname, this.port, true),
            txt: new TXTRecord_1.TXTRecord(this.fqdn, this.txt, true),
            serviceNSEC: new NSECRecord_1.NSECRecord(this.fqdn, this.fqdn, [16 /* RType.TXT */, 33 /* RType.SRV */], 4500, true), // 4500 ttl of src and txt
            a: aRecordMap,
            aaaa: aaaaRecordMap,
            aaaaR: aaaaRoutableRecordMap,
            aaaaULA: aaaaUniqueLocalRecordMap,
            reverseAddressPTRs: reverseAddressMap,
            addressNSEC: new NSECRecord_1.NSECRecord(this.hostname, this.hostname, [1 /* RType.A */, 28 /* RType.AAAA */], 120, true), // 120 TTL of A and AAAA records
        };
    }
    /**
     * Returns if the given service is advertising on the provided network interface.
     *
     * @param name - The desired interface name.
     * @param skipAddressCheck - If true it is not checked if the service actually has
     *   an address record for the given interface.
     * @private returns if the service should be advertised on the given service
     */
    advertisesOnInterface(name, skipAddressCheck) {
        var _a, _b, _c, _d;
        return !this.restrictedAddresses || this.restrictedAddresses.has(name) && (skipAddressCheck ||
            // must have at least one address record on the given interface
            !!((_a = this.serviceRecords) === null || _a === void 0 ? void 0 : _a.a[name]) || !!((_b = this.serviceRecords) === null || _b === void 0 ? void 0 : _b.aaaa[name])
            || !!((_c = this.serviceRecords) === null || _c === void 0 ? void 0 : _c.aaaaR[name]) || !!((_d = this.serviceRecords) === null || _d === void 0 ? void 0 : _d.aaaaULA[name]));
    }
    /**
     * @private used to get a copy of the main PTR record
     */
    ptrRecord() {
        return this.serviceRecords.ptr.clone();
    }
    /**
     * @private used to get a copy of the array of subtype PTR records
     */
    subtypePtrRecords() {
        return this.serviceRecords.subtypePTRs ? ResourceRecord_1.ResourceRecord.clone(this.serviceRecords.subtypePTRs) : [];
    }
    /**
     * @private used to get a copy of the meta-query PTR record
     */
    metaQueryPtrRecord() {
        return this.serviceRecords.metaQueryPtr.clone();
    }
    /**
     * @private used to get a copy of the SRV record
     */
    srvRecord() {
        return this.serviceRecords.srv.clone();
    }
    /**
     * @private used to get a copy of the TXT record
     */
    txtRecord() {
        return this.serviceRecords.txt.clone();
    }
    /**
     * @private used to get a copy of the A record
     */
    aRecord(name) {
        const record = this.serviceRecords.a[name];
        return record ? record.clone() : undefined;
    }
    /**
     * @private used to get a copy of the AAAA record for the link-local ipv6 address
     */
    aaaaRecord(name) {
        const record = this.serviceRecords.aaaa[name];
        return record ? record.clone() : undefined;
    }
    /**
     * @private used to get a copy of the AAAA record for the routable ipv6 address
     */
    aaaaRoutableRecord(name) {
        const record = this.serviceRecords.aaaaR[name];
        return record ? record.clone() : undefined;
    }
    /**
     * @private used to get a copy of the AAAA for the unique local ipv6 address
     */
    aaaaUniqueLocalRecord(name) {
        const record = this.serviceRecords.aaaaULA[name];
        return record ? record.clone() : undefined;
    }
    /**
     * @private used to get a copy of the A and AAAA records
     */
    allAddressRecords() {
        const records = [];
        Object.values(this.serviceRecords.a).forEach(record => {
            records.push(record.clone());
        });
        Object.values(this.serviceRecords.aaaa).forEach(record => {
            records.push(record.clone());
        });
        Object.values(this.serviceRecords.aaaaR).forEach(record => {
            records.push(record.clone());
        });
        Object.values(this.serviceRecords.aaaaULA).forEach(record => {
            records.push(record.clone());
        });
        return records;
    }
    /**
     * @private used to get a copy of the address NSEC record
     */
    addressNSECRecord() {
        return this.serviceRecords.addressNSEC.clone();
    }
    /**
     * @private user to get a copy of the service NSEC record
     */
    serviceNSECRecord(shortenTTL = false) {
        const record = this.serviceRecords.serviceNSEC.clone();
        if (shortenTTL) {
            record.ttl = 120;
        }
        return record;
    }
    /**
     * @param address - The IP address to check.
     * @private used to check if given address is exposed by this service
     */
    hasAddress(address) {
        return !!this.serviceRecords.reverseAddressPTRs[address];
    }
}
exports.CiaoService = CiaoService;
//# sourceMappingURL=CiaoService.js.map