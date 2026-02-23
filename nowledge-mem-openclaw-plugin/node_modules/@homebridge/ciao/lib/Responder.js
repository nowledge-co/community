"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Responder = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const CiaoService_1 = require("./CiaoService");
const DNSPacket_1 = require("./coder/DNSPacket");
const Question_1 = require("./coder/Question");
const AAAARecord_1 = require("./coder/records/AAAARecord");
const ARecord_1 = require("./coder/records/ARecord");
const PTRRecord_1 = require("./coder/records/PTRRecord");
const SRVRecord_1 = require("./coder/records/SRVRecord");
const TXTRecord_1 = require("./coder/records/TXTRecord");
const MDNSServer_1 = require("./MDNSServer");
const Announcer_1 = require("./responder/Announcer");
const Prober_1 = require("./responder/Prober");
const QueryResponse_1 = require("./responder/QueryResponse");
const QueuedResponse_1 = require("./responder/QueuedResponse");
const TruncatedQuery_1 = require("./responder/TruncatedQuery");
const errors_1 = require("./util/errors");
const promise_utils_1 = require("./util/promise-utils");
const sorted_array_1 = require("./util/sorted-array");
const debug = (0, debug_1.default)("ciao:Responder");
const queuedResponseComparator = (a, b) => {
    return a.estimatedTimeToBeSent - b.estimatedTimeToBeSent;
};
var ConflictType;
(function (ConflictType) {
    ConflictType[ConflictType["NO_CONFLICT"] = 0] = "NO_CONFLICT";
    ConflictType[ConflictType["CONFLICTING_RDATA"] = 1] = "CONFLICTING_RDATA";
    ConflictType[ConflictType["CONFLICTING_TTL"] = 2] = "CONFLICTING_TTL";
})(ConflictType || (ConflictType = {}));
/**
 * A Responder instance represents a running MDNSServer and a set of advertised services.
 *
 * It will handle any service related operations, like advertising, sending goodbye packets or sending record updates.
 * It handles answering questions arriving at the multicast address.
 */
class Responder {
    /**
     * Refer to {@link getResponder} in the index file
     *
     * @private should not be used directly. Please use the getResponder method defined in index file.
     */
    static getResponder(options) {
        const optionsString = options ? JSON.stringify(options) : "";
        const responder = this.INSTANCES.get(optionsString);
        if (responder) {
            responder.refCount++;
            return responder;
        }
        else {
            const responder = new Responder(options);
            this.INSTANCES.set(optionsString, responder);
            responder.optionsString = optionsString;
            return responder;
        }
    }
    constructor(options) {
        this.refCount = 1;
        this.optionsString = "";
        this.bound = false;
        /**
         * Announced services is indexed by the {@link dnsLowerCase} if the fqdn (as of RFC 1035 3.1).
         * As soon as the probing step is finished the service is added to the announced services Map.
         */
        this.announcedServices = new Map();
        /**
         * map representing all our shared PTR records.
         * Typically, we hold stuff like '_services._dns-sd._udp.local' (RFC 6763 9.), '_hap._tcp.local'.
         * Also, pointers for every subtype like '_printer._sub._http._tcp.local' are inserted here.
         *
         * For every pointer we may hold multiple entries (like multiple services can advertise on _hap._tcp.local).
         * The key as well as all values are {@link dnsLowerCase}
         */
        this.servicePointer = new Map();
        this.truncatedQueries = {}; // indexed by <ip>:<port>
        this.delayedMulticastResponses = [];
        this.server = new MDNSServer_1.MDNSServer(this, options);
        this.promiseChain = this.start();
        this.server.getNetworkManager().on("network-update" /* NetworkManagerEvent.NETWORK_UPDATE */, this.handleNetworkUpdate.bind(this));
        this.ignoreUnicastResponseFlag = options === null || options === void 0 ? void 0 : options.ignoreUnicastResponseFlag;
        if (options === null || options === void 0 ? void 0 : options.periodicBroadcasts) {
            this.broadcastInterval = setTimeout(this.handlePeriodicBroadcasts.bind(this), 30000).unref();
        }
    }
    handlePeriodicBroadcasts() {
        this.broadcastInterval = undefined;
        debug("Sending periodic announcement on " + Array.from(this.server.getNetworkManager().getInterfaceMap().keys()).join(", "));
        const boundInterfaceNames = Array.from(this.server.getBoundInterfaceNames());
        for (const networkInterface of this.server.getNetworkManager().getInterfaceMap().values()) {
            const question = new Question_1.Question("_hap._tcp.local.", 12 /* QType.PTR */, false);
            let responses4 = [], responses6 = [];
            if (boundInterfaceNames.includes(networkInterface.name)) {
                responses4 = this.answerQuestion(question, {
                    port: 5353,
                    address: networkInterface.ipv4Netaddress,
                    interface: networkInterface.name,
                });
            }
            if (boundInterfaceNames.includes(networkInterface.name + "/6")) {
                responses6 = this.answerQuestion(question, {
                    port: 5353,
                    address: networkInterface.ipv6,
                    interface: networkInterface.name + "/6",
                });
            }
            const responses = [...responses4, ...responses6];
            QueryResponse_1.QueryResponse.combineResponses(responses);
            for (const response of responses) {
                if (!response.hasAnswers()) {
                    continue;
                }
                this.server.sendResponse(response.asPacket(), networkInterface.name);
            }
        }
        this.broadcastInterval = setTimeout(this.handlePeriodicBroadcasts.bind(this), Math.random() * 3000 + 27000).unref();
    }
    /**
     * Creates a new CiaoService instance and links it to this Responder instance.
     *
     * @param {ServiceOptions} options - Defines all information about the service which should be created.
     * @returns The newly created {@link CiaoService} instance can be used to advertise and manage the created service.
     */
    createService(options) {
        const service = new CiaoService_1.CiaoService(this.server.getNetworkManager(), options);
        service.on("publish" /* InternalServiceEvent.PUBLISH */, this.advertiseService.bind(this, service));
        service.on("unpublish" /* InternalServiceEvent.UNPUBLISH */, this.unpublishService.bind(this, service));
        service.on("republish" /* InternalServiceEvent.REPUBLISH */, this.republishService.bind(this, service));
        service.on("records-update" /* InternalServiceEvent.RECORD_UPDATE */, this.handleServiceRecordUpdate.bind(this, service));
        service.on("records-update-interface" /* InternalServiceEvent.RECORD_UPDATE_ON_INTERFACE */, this.handleServiceRecordUpdateOnInterface.bind(this, service));
        return service;
    }
    /**
     * This method should be called when you want to unpublish all service exposed by this Responder.
     * This method SHOULD be called before the node application exists, so any host on the
     * network is informed of the shutdown of this machine.
     * Calling the shutdown method is mandatory for a clean termination (sending goodbye packets).
     *
     * The shutdown method must only be called ONCE.
     *
     * @returns The Promise resolves once all goodbye packets were sent
     * (or immediately if any other users have a reference to this Responder instance).
     */
    shutdown() {
        this.refCount--; // we trust the user here, that the shutdown will not be executed twice or something :thinking:
        if (this.refCount > 0) {
            return Promise.resolve();
        }
        if (this.currentProber) {
            // Services which are in Probing step aren't included in announcedServices Map
            // thus we need to cancel them as well
            this.currentProber.cancel();
        }
        if (this.broadcastInterval) {
            clearTimeout(this.broadcastInterval);
        }
        Responder.INSTANCES.delete(this.optionsString);
        debug("Shutting down Responder...");
        const promises = [];
        for (const service of this.announcedServices.values()) {
            promises.push(this.unpublishService(service));
        }
        return Promise.all(promises).then(() => {
            this.server.shutdown();
            this.bound = false;
        });
    }
    getAnnouncedServices() {
        return this.announcedServices.values();
    }
    start() {
        if (this.bound) {
            throw new Error("Server is already bound!");
        }
        this.bound = true;
        return this.server.bind();
    }
    advertiseService(service, callback) {
        if (service.serviceState === "announced" /* ServiceState.ANNOUNCED */) {
            throw new Error("Can't publish a service that is already announced. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        else if (service.serviceState === "probing" /* ServiceState.PROBING */) {
            return this.promiseChain.then(() => {
                if (service.currentAnnouncer) {
                    return service.currentAnnouncer.awaitAnnouncement();
                }
            });
        }
        else if (service.serviceState === "announcing" /* ServiceState.ANNOUNCING */) {
            (0, assert_1.default)(service.currentAnnouncer, "Service is in state ANNOUNCING though has no linked announcer!");
            if (service.currentAnnouncer.isSendingGoodbye()) {
                return service.currentAnnouncer.awaitAnnouncement().then(() => this.advertiseService(service, callback));
            }
            else {
                return service.currentAnnouncer.cancel().then(() => this.advertiseService(service, callback));
            }
        }
        debug("[%s] Going to advertise service...", service.getFQDN()); // TODO include restricted addresses and stuff
        // multicast loopback is not enabled for our sockets, though we do some stuff, so Prober will handle potential
        // name conflicts with our own services:
        //  - One Responder will always run ONE prober: no need to handle simultaneous probe tiebreaking
        //  - Prober will call the Responder to generate responses to its queries to
        //      resolve name conflicts the same way as with other services on the network
        this.promiseChain = this.promiseChain // we synchronize all ongoing probes here
            .then(() => service.rebuildServiceRecords()) // build the records the first time for the prober
            .then(() => this.probe(service)); // probe errors are catch below
        return this.promiseChain.then(() => {
            // we are not returning the promise returned by announced here, only PROBING is synchronized
            this.announce(service).catch(reason => {
                // handle announce errors
                console.log(`[${service.getFQDN()}] failed announcing with reason: ${reason}. Trying again in 2 seconds!`);
                return (0, promise_utils_1.PromiseTimeout)(2000).then(() => this.advertiseService(service, () => {
                    // empty
                }));
            });
            callback(); // service is considered announced. After the call to the announce() method the service state is set to ANNOUNCING
        }, reason => {
            /*
             * I know seems unintuitive to place the probe error handling below here, miles away from the probe method call.
             * Trust me it makes sense (encountered regression now two times in a row).
             * 1. We can't put it in the THEN call above, since then errors simply won't be handled from the probe method call.
             *  (CANCEL error would be passed through and would result in some unwanted stack trace)
             * 2. We can't add a catch call above, since otherwise we would silence the CANCEL would be silenced and announce
             *  would be called anyway.
             */
            // handle probe error
            if (reason === Prober_1.Prober.CANCEL_REASON) {
                callback();
            }
            else { // other errors are only thrown when sockets error occur
                console.log(`[${service.getFQDN()}] failed probing with reason: ${reason}. Trying again in 2 seconds!`);
                return (0, promise_utils_1.PromiseTimeout)(2000).then(() => this.advertiseService(service, callback));
            }
        });
    }
    async republishService(service, callback, delayAnnounce = false) {
        if (service.serviceState !== "announced" /* ServiceState.ANNOUNCED */ && service.serviceState !== "announcing" /* ServiceState.ANNOUNCING */) {
            throw new Error("Can't unpublish a service which isn't announced yet. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        debug("[%s] Readvertising service...", service.getFQDN());
        if (service.serviceState === "announcing" /* ServiceState.ANNOUNCING */) {
            (0, assert_1.default)(service.currentAnnouncer, "Service is in state ANNOUNCING though has no linked announcer!");
            const promise = service.currentAnnouncer.isSendingGoodbye()
                ? service.currentAnnouncer.awaitAnnouncement()
                : service.currentAnnouncer.cancel();
            return promise.then(() => this.advertiseService(service, callback));
        }
        // first of all remove it from our advertisedService Map and remove all the maintained PTRs
        this.clearService(service);
        service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */; // the service is now considered unannounced
        // and now we basically just announce the service by doing probing and the 'announce' step
        if (delayAnnounce) {
            return (0, promise_utils_1.PromiseTimeout)(1000)
                .then(() => this.advertiseService(service, callback));
        }
        else {
            return this.advertiseService(service, callback);
        }
    }
    unpublishService(service, callback) {
        if (service.serviceState === "unannounced" /* ServiceState.UNANNOUNCED */) {
            throw new Error("Can't unpublish a service which isn't announced yet. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        if (service.serviceState === "announced" /* ServiceState.ANNOUNCED */ || service.serviceState === "announcing" /* ServiceState.ANNOUNCING */) {
            if (service.serviceState === "announcing" /* ServiceState.ANNOUNCING */) {
                (0, assert_1.default)(service.currentAnnouncer, "Service is in state ANNOUNCING though has no linked announcer!");
                if (service.currentAnnouncer.isSendingGoodbye()) {
                    return service.currentAnnouncer.awaitAnnouncement(); // we are already sending a goodbye
                }
                return service.currentAnnouncer.cancel().then(() => {
                    service.serviceState = "announced" /* ServiceState.ANNOUNCED */; // unpublishService requires announced state
                    return this.unpublishService(service, callback);
                });
            }
            debug("[%s] Removing service from the network", service.getFQDN());
            this.clearService(service);
            service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
            let promise = this.goodbye(service);
            if (callback) {
                promise = promise.then(() => callback(), reason => {
                    console.log(`[${service.getFQDN()}] failed goodbye with reason: ${reason}.`);
                    callback();
                });
            }
            return promise;
        }
        else if (service.serviceState === "probing" /* ServiceState.PROBING */) {
            debug("[%s] Canceling probing", service.getFQDN());
            if (this.currentProber && this.currentProber.getService() === service) {
                this.currentProber.cancel();
                this.currentProber = undefined;
            }
            service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
        }
        if (typeof callback === "function") {
            callback();
        }
        return Promise.resolve();
    }
    clearService(service) {
        const serviceFQDN = service.getLowerCasedFQDN();
        const typePTR = service.getLowerCasedTypePTR();
        const subtypePTRs = service.getLowerCasedSubtypePTRs(); // possibly undefined
        this.removePTR(Responder.SERVICE_TYPE_ENUMERATION_NAME, typePTR);
        this.removePTR(typePTR, serviceFQDN);
        if (subtypePTRs) {
            for (const ptr of subtypePTRs) {
                this.removePTR(ptr, serviceFQDN);
            }
        }
        this.announcedServices.delete(service.getLowerCasedFQDN());
    }
    addPTR(ptr, name) {
        // we don't call lower case here, as we expect the caller to have done that already
        // name = dnsLowerCase(name); // worst case is that the meta query ptr record contains lower cased destination
        const names = this.servicePointer.get(ptr);
        if (names) {
            if (!names.includes(name)) {
                names.push(name);
            }
        }
        else {
            this.servicePointer.set(ptr, [name]);
        }
    }
    removePTR(ptr, name) {
        const names = this.servicePointer.get(ptr);
        if (names) {
            const index = names.indexOf(name);
            if (index !== -1) {
                names.splice(index, 1);
            }
            if (names.length === 0) {
                this.servicePointer.delete(ptr);
            }
        }
    }
    probe(service) {
        if (service.serviceState !== "unannounced" /* ServiceState.UNANNOUNCED */) {
            throw new Error("Can't probe for a service which is announced already. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        service.serviceState = "probing" /* ServiceState.PROBING */;
        (0, assert_1.default)(this.currentProber === undefined, "Tried creating new Prober when there already was one active!");
        this.currentProber = new Prober_1.Prober(this, this.server, service);
        return this.currentProber.probe()
            .then(() => {
            this.currentProber = undefined;
            service.serviceState = "probed" /* ServiceState.PROBED */;
        }, reason => {
            service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
            this.currentProber = undefined;
            return Promise.reject(reason); // forward reason
        });
    }
    announce(service) {
        if (service.serviceState !== "probed" /* ServiceState.PROBED */) {
            throw new Error("Cannot announce service which was not probed unique. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        (0, assert_1.default)(service.currentAnnouncer === undefined, "Service " + service.getFQDN() + " is already announcing!");
        service.serviceState = "announcing" /* ServiceState.ANNOUNCING */;
        const announcer = new Announcer_1.Announcer(this.server, service, {
            repetitions: 3,
        });
        service.currentAnnouncer = announcer;
        const serviceFQDN = service.getLowerCasedFQDN();
        const typePTR = service.getLowerCasedTypePTR();
        const subtypePTRs = service.getLowerCasedSubtypePTRs(); // possibly undefined
        this.addPTR(Responder.SERVICE_TYPE_ENUMERATION_NAME, typePTR);
        this.addPTR(typePTR, serviceFQDN);
        if (subtypePTRs) {
            for (const ptr of subtypePTRs) {
                this.addPTR(ptr, serviceFQDN);
            }
        }
        this.announcedServices.set(serviceFQDN, service);
        return announcer.announce().then(() => {
            service.serviceState = "announced" /* ServiceState.ANNOUNCED */;
            service.currentAnnouncer = undefined;
        }, reason => {
            service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
            service.currentAnnouncer = undefined;
            this.clearService(service); // also removes entry from announcedServices
            if (reason !== Announcer_1.Announcer.CANCEL_REASON) {
                // forward reason if it is not a cancellation.
                // We do not forward cancel reason. Announcements only get cancelled if we have something "better" to do.
                // So the race is already handled by us.
                return Promise.reject(reason);
            }
        });
    }
    handleServiceRecordUpdate(service, response, callback) {
        var _a;
        // when updating we just repeat the 'announce' step
        if (service.serviceState !== "announced" /* ServiceState.ANNOUNCED */) { // different states are already handled in CiaoService where this event handler is fired
            throw new Error("Cannot update txt of service which is not announced yet. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        debug("[%s] Updating %d record(s) for given service!", service.getFQDN(), response.answers.length + (((_a = response.additionals) === null || _a === void 0 ? void 0 : _a.length) || 0));
        // TODO we should do a announcement at this point "in theory"
        this.server.sendResponseBroadcast(response, service).then(results => {
            const failRatio = (0, MDNSServer_1.SendResultFailedRatio)(results);
            if (failRatio === 1) {
                console.log((0, MDNSServer_1.SendResultFormatError)(results, `Failed to send records update for '${service.getFQDN()}'`), true);
                if (callback) {
                    callback(new Error("Updating records failed as of socket errors!"));
                }
                return; // all failed => updating failed
            }
            if (failRatio > 0) {
                // some queries on some interfaces failed, but not all. We log that but consider that to be a success
                // at this point we are not responsible for removing stale network interfaces or something
                debug((0, MDNSServer_1.SendResultFormatError)(results, `Some of the record updates for '${service.getFQDN()}' failed`));
                // SEE no return here
            }
            if (callback) {
                callback();
            }
        });
    }
    handleServiceRecordUpdateOnInterface(service, name, records, callback) {
        // when updating we just repeat the 'announce' step
        if (service.serviceState !== "announced" /* ServiceState.ANNOUNCED */) { // different states are already handled in CiaoService where this event handler is fired
            throw new Error("Cannot update txt of service which is not announced yet. Received " + service.serviceState + " for service " + service.getFQDN());
        }
        debug("[%s] Updating %d record(s) for given service on interface %s!", service.getFQDN(), records.length, name);
        const packet = DNSPacket_1.DNSPacket.createDNSResponsePacketsFromRRSet({ answers: records });
        this.server.sendResponse(packet, name, callback);
    }
    goodbye(service) {
        (0, assert_1.default)(service.currentAnnouncer === undefined, "Service " + service.getFQDN() + " is already announcing!");
        service.serviceState = "announcing" /* ServiceState.ANNOUNCING */;
        const announcer = new Announcer_1.Announcer(this.server, service, {
            repetitions: 1,
            goodbye: true,
        });
        service.currentAnnouncer = announcer;
        return announcer.announce().then(() => {
            service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
            service.currentAnnouncer = undefined;
        }, reason => {
            // just assume unannounced. we won't be answering anymore, so the record will be flushed from cache sometime.
            service.serviceState = "unannounced" /* ServiceState.UNANNOUNCED */;
            service.currentAnnouncer = undefined;
            return Promise.reject(reason);
        });
    }
    handleNetworkUpdate(change) {
        for (const service of this.announcedServices.values()) {
            service.handleNetworkInterfaceUpdate(change);
        }
    }
    /**
     * @private method called by the MDNSServer when an incoming query needs ot be handled
     */
    handleQuery(packet, endpoint) {
        const start = new Date().getTime();
        const endpointId = endpoint.address + ":" + endpoint.port + ":" + endpoint.interface; // used to match truncated queries
        const previousQuery = this.truncatedQueries[endpointId];
        if (previousQuery) {
            const truncatedQueryResult = previousQuery.appendDNSPacket(packet);
            switch (truncatedQueryResult) {
                case 1 /* TruncatedQueryResult.ABORT */: // returned when we detect, that continuously TC queries are sent
                    delete this.truncatedQueries[endpointId];
                    debug("[%s] Aborting to wait for more truncated queries. Waited a total of %d ms receiving %d queries", endpointId, previousQuery.getTotalWaitTime(), previousQuery.getArrivedPacketCount());
                    return;
                case 2 /* TruncatedQueryResult.AGAIN_TRUNCATED */:
                    debug("[%s] Received a query marked as truncated, waiting for more to arrive", endpointId);
                    return; // wait for the next packet
                case 3 /* TruncatedQueryResult.FINISHED */:
                    delete this.truncatedQueries[endpointId];
                    packet = previousQuery.getPacket(); // replace packet with the complete deal
                    debug("[%s] Last part of the truncated query arrived. Received %d packets taking a total of %d ms", endpointId, previousQuery.getArrivedPacketCount(), previousQuery.getTotalWaitTime());
                    break;
            }
        }
        else if (packet.flags.truncation) {
            // RFC 6763 18.5 truncate flag indicates that additional known-answer records follow shortly
            debug("Received truncated query from " + JSON.stringify(endpoint) + " waiting for more to come!");
            const truncatedQuery = new TruncatedQuery_1.TruncatedQuery(packet);
            this.truncatedQueries[endpointId] = truncatedQuery;
            truncatedQuery.on("timeout" /* TruncatedQueryEvent.TIMEOUT */, () => {
                // called when more than 400-500ms pass until the next packet arrives
                debug("[%s] Timeout passed since the last truncated query was received. Discarding %d packets received in %d ms.", endpointId, truncatedQuery.getArrivedPacketCount(), truncatedQuery.getTotalWaitTime());
                delete this.truncatedQueries[endpointId];
            });
            return; // wait for the next query
        }
        const isUnicastQuerier = endpoint.port !== MDNSServer_1.MDNSServer.MDNS_PORT; // explained below
        const isProbeQuery = packet.authorities.size > 0;
        let udpPayloadSize = undefined; // payload size supported by the querier
        for (const record of packet.additionals.values()) {
            if (record.type === 41 /* RType.OPT */) {
                udpPayloadSize = record.udpPayloadSize;
                break;
            }
        }
        // responses must not include questions RFC 6762 6.
        // known answer suppression according to RFC 6762 7.1.
        const multicastResponses = [];
        const unicastResponses = [];
        // gather answers for all the questions
        packet.questions.forEach(question => {
            const responses = this.answerQuestion(question, endpoint, packet.answers);
            if (isUnicastQuerier || question.unicastResponseFlag && !this.ignoreUnicastResponseFlag) {
                unicastResponses.push(...responses);
            }
            else {
                multicastResponses.push(...responses);
            }
        });
        if (this.currentProber) {
            this.currentProber.handleQuery(packet, endpoint);
        }
        if (isUnicastQuerier) {
            // we are dealing with a legacy unicast dns query (RFC 6762 6.7.)
            //  * MUSTS: response via unicast, repeat query ID, repeat questions, clear cache flush bit
            //  * SHOULDS: ttls should not be greater than 10s as legacy resolvers don't take part in the cache coherency mechanism
            for (let i = 0; i < unicastResponses.length; i++) {
                const response = unicastResponses[i];
                // only add questions to the first packet (will be combined anyway) and we must ensure
                // each packet stays unique in its records
                response.markLegacyUnicastResponse(packet.id, i === 0 ? Array.from(packet.questions.values()) : undefined);
            }
        }
        // RFC 6762 6.4. Response aggregation:
        //    When possible, a responder SHOULD, for the sake of network
        //    efficiency, aggregate as many responses as possible into a single
        //    Multicast DNS response message.  For example, when a responder has
        //    several responses it plans to send, each delayed by a different
        //    interval, then earlier responses SHOULD be delayed by up to an
        //    additional 500 ms if that will permit them to be aggregated with
        //    other responses scheduled to go out a little later.
        QueryResponse_1.QueryResponse.combineResponses(multicastResponses, udpPayloadSize);
        QueryResponse_1.QueryResponse.combineResponses(unicastResponses, udpPayloadSize);
        if (isUnicastQuerier && unicastResponses.length > 1) {
            // RFC 6762 18.5. In legacy unicast response messages, the TC bit has the same meaning
            //    as in conventional Unicast DNS: it means that the response was too
            //    large to fit in a single packet, so the querier SHOULD reissue its
            //    query using TCP in order to receive the larger response.
            unicastResponses.splice(1, unicastResponses.length - 1); // discard all other
            unicastResponses[0].markTruncated();
        }
        for (const unicastResponse of unicastResponses) {
            if (!unicastResponse.hasAnswers()) {
                continue;
            }
            this.server.sendResponse(unicastResponse.asPacket(), endpoint);
            const time = new Date().getTime() - start;
            debug("Sending response via unicast to %s (took %d ms): %s", JSON.stringify(endpoint), time, unicastResponse.asString(udpPayloadSize));
        }
        for (const multicastResponse of multicastResponses) {
            if (!multicastResponse.hasAnswers()) {
                continue;
            }
            if ((multicastResponse.containsSharedAnswer() || packet.questions.size > 1) && !isProbeQuery) {
                // We must delay the response on an interval of 20-120ms if we can't assure that we are the only one responding (shared records).
                // This is also the case if there are multiple questions. If multiple questions are asked
                // we probably could not answer them all (because not all of them were directed to us).
                // All those conditions are overridden if this is a probe query. To those queries we must respond instantly!
                const time = new Date().getTime() - start;
                this.enqueueDelayedMulticastResponse(multicastResponse.asPacket(), endpoint.interface, time);
            }
            else {
                // otherwise the response is sent immediately, if there isn't any packet in the queue
                // so first step is, check if there is a packet in the queue we are about to send out
                // which can be combined with our current packet without adding a delay > 500ms
                let sentWithLaterPacket = false;
                for (let i = 0; i < this.delayedMulticastResponses.length; i++) {
                    const delayedResponse = this.delayedMulticastResponses[i];
                    if (delayedResponse.getTimeTillSent() > QueuedResponse_1.QueuedResponse.MAX_DELAY) {
                        // all packets following won't be compatible either
                        break;
                    }
                    if (delayedResponse.combineWithUniqueResponseIfPossible(multicastResponse, endpoint.interface)) {
                        const time = new Date().getTime() - start;
                        sentWithLaterPacket = true;
                        debug("Multicast response on interface %s containing unique records (took %d ms) was combined with response which is sent out later", endpoint.interface, time);
                        break;
                    }
                }
                if (!sentWithLaterPacket) {
                    this.server.sendResponse(multicastResponse.asPacket(), endpoint.interface);
                    const time = new Date().getTime() - start;
                    debug("Sending response via multicast on network %s (took %d ms): %s", endpoint.interface, time, multicastResponse.asString(udpPayloadSize));
                }
            }
        }
    }
    /**
     * @private method called by the MDNSServer when an incoming response needs to be handled
     */
    handleResponse(packet, endpoint) {
        // any questions in a response must be ignored RFC 6762 6.
        if (this.currentProber) { // if there is a probing process running currently, just forward all messages to it
            this.currentProber.handleResponse(packet, endpoint);
        }
        for (const service of this.announcedServices.values()) {
            let conflictingRData = false;
            let ttlConflicts = 0; // we currently do a full-blown announcement with all records, we could in the future track which records have invalid ttl
            for (const record of packet.answers.values()) {
                const type = Responder.checkRecordConflictType(service, record, endpoint);
                if (type === 1 /* ConflictType.CONFLICTING_RDATA */) {
                    conflictingRData = true;
                    break; // we will republish in any case
                }
                else if (type === 2 /* ConflictType.CONFLICTING_TTL */) {
                    ttlConflicts++;
                }
            }
            if (!conflictingRData) {
                for (const record of packet.additionals.values()) {
                    const type = Responder.checkRecordConflictType(service, record, endpoint);
                    if (type === 1 /* ConflictType.CONFLICTING_RDATA */) {
                        conflictingRData = true;
                        break; // we will republish in any case
                    }
                    else if (type === 2 /* ConflictType.CONFLICTING_TTL */) {
                        ttlConflicts++;
                    }
                }
            }
            if (conflictingRData) {
                // noinspection JSIgnoredPromiseFromCall
                this.republishService(service, error => {
                    if (error) {
                        console.log(`FATAL Error occurred trying to resolve conflict for service ${service.getFQDN()}! We can't recover from this!`);
                        console.log(error.stack);
                        process.exit(1); // we have a service which should be announced, though we failed to reannounce.
                        // if this should ever happen in reality, whe might want to introduce a more sophisticated recovery
                        // for situations where it makes sense
                    }
                }, true);
            }
            else if (ttlConflicts && !service.currentAnnouncer) {
                service.serviceState = "announcing" /* ServiceState.ANNOUNCING */; // all code above doesn't expect an Announcer object in state ANNOUNCED
                const announcer = new Announcer_1.Announcer(this.server, service, {
                    repetitions: 1, // we send exactly one packet to correct any ttl values in neighbouring caches
                });
                service.currentAnnouncer = announcer;
                announcer.announce().then(() => {
                    service.currentAnnouncer = undefined;
                    service.serviceState = "announced" /* ServiceState.ANNOUNCED */;
                }, reason => {
                    service.currentAnnouncer = undefined;
                    service.serviceState = "announced" /* ServiceState.ANNOUNCED */;
                    if (reason === Announcer_1.Announcer.CANCEL_REASON) {
                        return; // nothing to worry about
                    }
                    console.warn("When trying to resolve a ttl conflict on the network, we were unable to send our response packet: " + reason.message);
                });
            }
        }
    }
    static checkRecordConflictType(service, record, endpoint) {
        // RFC 6762 9. Conflict Resolution:
        //    A conflict occurs when a Multicast DNS responder has a unique record
        //    for which it is currently authoritative, and it receives a Multicast
        //    DNS response message containing a record with the same name, rrtype
        //    and rrclass, but inconsistent rdata.  What may be considered
        //    inconsistent is context-sensitive, except that resource records with
        //    identical rdata are never considered inconsistent, even if they
        //    originate from different hosts.  This is to permit use of proxies and
        //    other fault-tolerance mechanisms that may cause more than one
        //    responder to be capable of issuing identical answers on the network.
        //
        //    A common example of a resource record type that is intended to be
        //    unique, not shared between hosts, is the address record that maps a
        //    host's name to its IP address.  Should a host witness another host
        //    announce an address record with the same name but a different IP
        //    address, then that is considered inconsistent, and that address
        //    record is considered to be in conflict.
        //
        //    Whenever a Multicast DNS responder receives any Multicast DNS
        //    response (solicited or otherwise) containing a conflicting resource
        //    record in any of the Resource Record Sections, the Multicast DNS
        //    responder MUST immediately reset its conflicted unique record to
        //    probing state, and go through the startup steps described above in
        //    Section 8, "Probing and Announcing on Startup".  The protocol used in
        //    the Probing phase will determine a winner and a loser, and the loser
        //    MUST cease using the name, and reconfigure.
        if (!service.advertisesOnInterface(endpoint.interface)) {
            return 0 /* ConflictType.NO_CONFLICT */;
        }
        const recordName = record.getLowerCasedName();
        if (recordName === service.getLowerCasedFQDN()) {
            if (record.type === 33 /* RType.SRV */) {
                const srvRecord = record;
                if (srvRecord.getLowerCasedHostname() !== service.getLowerCasedHostname()) {
                    debug("[%s] Noticed conflicting record on the network. SRV with hostname: %s", service.getFQDN(), srvRecord.hostname);
                    return 1 /* ConflictType.CONFLICTING_RDATA */;
                }
                else if (srvRecord.port !== service.getPort()) {
                    debug("[%s] Noticed conflicting record on the network. SRV with port: %s", service.getFQDN(), srvRecord.port);
                    return 1 /* ConflictType.CONFLICTING_RDATA */;
                }
                if (srvRecord.ttl < SRVRecord_1.SRVRecord.DEFAULT_TTL / 2) {
                    return 2 /* ConflictType.CONFLICTING_TTL */;
                }
            }
            else if (record.type === 16 /* RType.TXT */) {
                const txtRecord = record;
                const txt = service.getTXT();
                if (txt.length !== txtRecord.txt.length) { // length differs, can't be the same data
                    debug("[%s] Noticed conflicting record on the network. TXT with differing data length", service.getFQDN());
                    return 1 /* ConflictType.CONFLICTING_RDATA */;
                }
                for (let i = 0; i < txt.length; i++) {
                    const buffer0 = txt[i];
                    const buffer1 = txtRecord.txt[i];
                    if (buffer0.length !== buffer1.length || buffer0.toString("hex") !== buffer1.toString("hex")) {
                        debug("[%s] Noticed conflicting record on the network. TXT with differing data.", service.getFQDN());
                        return 1 /* ConflictType.CONFLICTING_RDATA */;
                    }
                }
                if (txtRecord.ttl < TXTRecord_1.TXTRecord.DEFAULT_TTL / 2) {
                    return 2 /* ConflictType.CONFLICTING_TTL */;
                }
            }
        }
        else if (recordName === service.getLowerCasedHostname()) {
            if (record.type === 1 /* RType.A */) {
                const aRecord = record;
                if (!service.hasAddress(aRecord.ipAddress)) {
                    // if the service doesn't expose the listed address we have a conflict
                    debug("[%s] Noticed conflicting record on the network. A with ip address: %s", service.getFQDN(), aRecord.ipAddress);
                    return 1 /* ConflictType.CONFLICTING_RDATA */;
                }
                if (aRecord.ttl < ARecord_1.ARecord.DEFAULT_TTL / 2) {
                    return 2 /* ConflictType.CONFLICTING_TTL */;
                }
            }
            else if (record.type === 28 /* RType.AAAA */) {
                const aaaaRecord = record;
                if (!service.hasAddress(aaaaRecord.ipAddress)) {
                    // if the service doesn't expose the listed address we have a conflict
                    debug("[%s] Noticed conflicting record on the network. AAAA with ip address: %s", service.getFQDN(), aaaaRecord.ipAddress);
                    return 1 /* ConflictType.CONFLICTING_RDATA */;
                }
                if (aaaaRecord.ttl < AAAARecord_1.AAAARecord.DEFAULT_TTL / 2) {
                    return 2 /* ConflictType.CONFLICTING_TTL */;
                }
            }
        }
        else if (record.type === 12 /* RType.PTR */) {
            const ptrRecord = record;
            if (recordName === service.getLowerCasedTypePTR()) {
                if (ptrRecord.getLowerCasedPTRName() === service.getLowerCasedFQDN() && ptrRecord.ttl < PTRRecord_1.PTRRecord.DEFAULT_TTL / 2) {
                    return 2 /* ConflictType.CONFLICTING_TTL */;
                }
            }
            else if (recordName === Responder.SERVICE_TYPE_ENUMERATION_NAME) {
                // nothing to do here, I guess
            }
            else {
                const subTypes = service.getLowerCasedSubtypePTRs();
                if (subTypes && subTypes.includes(recordName)
                    && ptrRecord.getLowerCasedPTRName() === service.getLowerCasedFQDN() && ptrRecord.ttl < PTRRecord_1.PTRRecord.DEFAULT_TTL / 2) {
                    return 2 /* ConflictType.CONFLICTING_TTL */;
                }
            }
        }
        return 0 /* ConflictType.NO_CONFLICT */;
    }
    enqueueDelayedMulticastResponse(packet, interfaceName, time) {
        const response = new QueuedResponse_1.QueuedResponse(packet, interfaceName);
        response.calculateRandomDelay();
        (0, sorted_array_1.sortedInsert)(this.delayedMulticastResponses, response, queuedResponseComparator);
        // run combine/delay checks
        for (let i = 0; i < this.delayedMulticastResponses.length; i++) {
            const response0 = this.delayedMulticastResponses[i];
            // search for any packets sent out after this packet
            for (let j = i + 1; j < this.delayedMulticastResponses.length; j++) {
                const response1 = this.delayedMulticastResponses[j];
                if (!response0.delayWouldBeInTimelyManner(response1)) {
                    // all packets following won't be compatible either
                    break;
                }
                if (response0.combineWithNextPacketIfPossible(response1)) {
                    // combine was a success and the packet got delay
                    // remove the packet from the queue
                    const index = this.delayedMulticastResponses.indexOf(response0);
                    if (index !== -1) {
                        this.delayedMulticastResponses.splice(index, 1);
                    }
                    i--; // reduce i, as one element got removed from the queue
                    break;
                }
                // otherwise we continue with maybe some packets further ahead
            }
        }
        if (!response.delayed) {
            // only set timer if packet got not delayed
            response.scheduleResponse(() => {
                const index = this.delayedMulticastResponses.indexOf(response);
                if (index !== -1) {
                    this.delayedMulticastResponses.splice(index, 1);
                }
                try {
                    this.server.sendResponse(response.getPacket(), interfaceName);
                    debug("Sending (delayed %dms) response via multicast on network interface %s (took %d ms): %s", Math.round(response.getTimeSinceCreation()), interfaceName, time, response.getPacket().asLoggingString());
                }
                catch (error) {
                    if (error.name === errors_1.ERR_INTERFACE_NOT_FOUND) {
                        debug("Multicast response (delayed %dms) was cancelled as the network interface %s is no longer available!", Math.round(response.getTimeSinceCreation()), interfaceName);
                    }
                    else if (error.name === errors_1.ERR_SERVER_CLOSED) {
                        debug("Multicast response (delayed %dms) was cancelled as the server is about to be shutdown!", Math.round(response.getTimeSinceCreation()));
                    }
                    else {
                        throw error;
                    }
                }
            });
        }
    }
    answerQuestion(question, endpoint, knownAnswers) {
        // RFC 6762 6: The determination of whether a given record answers a given question
        //    is made using the standard DNS rules: the record name must match the
        //    question name, the record rrtype must match the question qtype unless
        //    the qtype is "ANY" (255) or the rrtype is "CNAME" (5), and the record
        //    rrclass must match the question qclass unless the qclass is "ANY" (255).
        if (question.class !== 1 /* QClass.IN */ && question.class !== 255 /* QClass.ANY */) {
            // We just publish answers with IN class. So only IN or ANY questions classes will match
            return [];
        }
        const serviceResponses = [];
        let metaQueryResponse = undefined;
        if (question.type === 12 /* QType.PTR */ || question.type === 255 /* QType.ANY */ || question.type === 5 /* QType.CNAME */) {
            const destinations = this.servicePointer.get(question.getLowerCasedName()); // look up the pointer, all entries are dnsLowerCased
            if (destinations) {
                // if it's a pointer name, we handle it here
                for (const data of destinations) {
                    // check if the PTR is pointing towards a service, like in questions for PTR '_hap._tcp.local'
                    // if that's the case, let the question be answered by the service itself
                    const service = this.announcedServices.get(data);
                    if (service) {
                        if (service.advertisesOnInterface(endpoint.interface)) {
                            // call the method for original question, so additionals get added properly
                            const response = Responder.answerServiceQuestion(service, question, endpoint, knownAnswers);
                            if (response.hasAnswers()) {
                                serviceResponses.push(response);
                            }
                        }
                    }
                    else {
                        if (!metaQueryResponse) {
                            metaQueryResponse = new QueryResponse_1.QueryResponse(knownAnswers);
                            serviceResponses.unshift(metaQueryResponse);
                        }
                        // it's probably question for PTR '_services._dns-sd._udp.local'
                        // the PTR will just point to something like '_hap._tcp.local' thus no additional records need to be included
                        metaQueryResponse.addAnswer(new PTRRecord_1.PTRRecord(question.name, data));
                        // we may send out meta queries on interfaces where there aren't any services, because they are
                        //  restricted to other interfaces.
                    }
                }
                return serviceResponses; // if we got in this if-body, it was a pointer name and we handled it correctly
            } /* else if (loweredQuestionName.endsWith(".in-addr.arpa") || loweredQuestionName.endsWith(".ip6.arpa")) { // reverse address lookup
                const address = ipAddressFromReversAddressName(loweredQuestionName);
      
                for (const service of this.announcedServices.values()) {
                  const record = service.reverseAddressMapping(address);
                  if (record) {
                    mainResponse.addAnswer(record);
                  }
                }
              }
              We won't actually respond to reverse address queries.
              This typically confuses responders like avahi, which then over and over try to increment the hostname.
              */
        }
        for (const service of this.announcedServices.values()) {
            if (!service.advertisesOnInterface(endpoint.interface)) {
                continue;
            }
            const response = Responder.answerServiceQuestion(service, question, endpoint, knownAnswers);
            if (response.hasAnswers()) {
                serviceResponses.push(response);
            }
        }
        return serviceResponses;
    }
    static answerServiceQuestion(service, question, endpoint, knownAnswers) {
        // This assumes to be called from answerQuestion inside the Responder class and thus that certain
        // preconditions or special cases are already covered.
        // For one, we assume classes are already matched.
        const response = new QueryResponse_1.QueryResponse(knownAnswers);
        const loweredQuestionName = question.getLowerCasedName();
        const askingAny = question.type === 255 /* QType.ANY */ || question.type === 5 /* QType.CNAME */;
        const addAnswer = response.addAnswer.bind(response);
        const addAdditional = response.addAdditional.bind(response);
        // RFC 6762 6.2. In the event that a device has only IPv4 addresses but no IPv6
        //    addresses, or vice versa, then the appropriate NSEC record SHOULD be
        //    placed into the additional section, so that queriers can know with
        //    certainty that the device has no addresses of that kind.
        if (loweredQuestionName === service.getLowerCasedTypePTR()) {
            if (askingAny || question.type === 12 /* QType.PTR */) {
                const added = response.addAnswer(service.ptrRecord());
                if (added) {
                    // only add additionals if answer is not suppressed by the known answer section
                    // RFC 6763 12.1: include additionals: srv, txt, a, aaaa
                    response.addAdditional(service.txtRecord(), service.srvRecord());
                    this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAdditional);
                    this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAdditional);
                    response.addAdditional(service.serviceNSECRecord(), service.addressNSECRecord());
                }
            }
        }
        else if (loweredQuestionName === service.getLowerCasedFQDN()) {
            if (askingAny) {
                response.addAnswer(service.txtRecord());
                const addedSrv = response.addAnswer(service.srvRecord());
                if (addedSrv) {
                    // RFC 6763 12.2: include additionals: a, aaaa
                    this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAdditional);
                    this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAdditional);
                    response.addAdditional(service.serviceNSECRecord(), service.addressNSECRecord());
                }
            }
            else if (question.type === 33 /* QType.SRV */) {
                const added = response.addAnswer(service.srvRecord());
                if (added) {
                    // RFC 6763 12.2: include additionals: a, aaaa
                    this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAdditional);
                    this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAdditional);
                    response.addAdditional(service.serviceNSECRecord(true), service.addressNSECRecord());
                }
            }
            else if (question.type === 16 /* QType.TXT */) {
                response.addAnswer(service.txtRecord());
                response.addAdditional(service.serviceNSECRecord());
                // RFC 6763 12.3: not any other additionals
            }
        }
        else if (loweredQuestionName === service.getLowerCasedHostname() || loweredQuestionName + "local." === service.getLowerCasedHostname()) {
            if (askingAny) {
                this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAnswer);
                this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAnswer);
                response.addAdditional(service.addressNSECRecord());
            }
            else if (question.type === 1 /* QType.A */) {
                // RFC 6762 6.2 When a Multicast DNS responder places an IPv4 or IPv6 address record
                //    (rrtype "A" or "AAAA") into a response message, it SHOULD also place
                //    any records of the other address type with the same name into the
                //    additional section, if there is space in the message.
                const added = this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAnswer);
                if (added) {
                    this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAdditional);
                }
                response.addAdditional(service.addressNSECRecord()); // always add the negative response, always assert dominance
            }
            else if (question.type === 28 /* QType.AAAA */) {
                // RFC 6762 6.2 When a Multicast DNS responder places an IPv4 or IPv6 address record
                //    (rrtype "A" or "AAAA") into a response message, it SHOULD also place
                //    any records of the other address type with the same name into the
                //    additional section, if there is space in the message.
                const added = this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAnswer);
                if (added) {
                    this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAdditional);
                }
                response.addAdditional(service.addressNSECRecord()); // always add the negative response, always assert dominance
            }
        }
        else if (service.getLowerCasedSubtypePTRs()) {
            if (askingAny || question.type === 12 /* QType.PTR */) {
                const dnsLowerSubTypes = service.getLowerCasedSubtypePTRs();
                const index = dnsLowerSubTypes.indexOf(loweredQuestionName);
                if (index !== -1) { // we have a subtype for the question
                    const records = service.subtypePtrRecords();
                    const record = records[index];
                    (0, assert_1.default)(loweredQuestionName === record.name, "Question Name didn't match selected sub type ptr record!");
                    const added = response.addAnswer(record);
                    if (added) {
                        // RFC 6763 12.1: include additionals: srv, txt, a, aaaa
                        response.addAdditional(service.txtRecord(), service.srvRecord());
                        this.addAddressRecords(service, endpoint, 1 /* RType.A */, addAdditional);
                        this.addAddressRecords(service, endpoint, 28 /* RType.AAAA */, addAdditional);
                        response.addAdditional(service.serviceNSECRecord(), service.addressNSECRecord());
                    }
                }
            }
        }
        return response;
    }
    /**
     * This method is a helper method to reduce the complexity inside {@link answerServiceQuestion}.
     * The method calculates which A and AAAA records to be added for a given {@code endpoint} using
     * the records from the provided {@code service}.
     * It will add the records by calling the provided {@code dest} method.
     *
     * @param {CiaoService} service - service which records to be use
     * @param {EndpointInfo} endpoint - endpoint information providing the interface
     * @param {RType.A | RType.AAAA} type - defines the type of records to be added
     * @param {RecordAddMethod} dest - defines the destination which the records should be added
     * @returns true if any records got added
     */
    static addAddressRecords(service, endpoint, type, dest) {
        const endpointInterface = endpoint.interface.endsWith("/6") ? endpoint.interface.substr(0, endpoint.interface.length - 2) : endpoint.interface;
        if (type === 1 /* RType.A */) {
            const record = service.aRecord(endpointInterface);
            return record ? dest(record) : false;
        }
        else if (type === 28 /* RType.AAAA */) {
            const record = service.aaaaRecord(endpointInterface);
            const routableRecord = service.aaaaRoutableRecord(endpointInterface);
            const ulaRecord = service.aaaaUniqueLocalRecord(endpointInterface);
            let addedAny = false;
            if (record) {
                addedAny = dest(record);
            }
            if (routableRecord) {
                const added = dest(routableRecord);
                addedAny = addedAny || added;
            }
            if (ulaRecord) {
                const added = dest(ulaRecord);
                addedAny = addedAny || added;
            }
            return addedAny;
        }
        else {
            assert_1.default.fail("Illegal argument!");
        }
    }
}
exports.Responder = Responder;
/**
 * @private
 */
Responder.SERVICE_TYPE_ENUMERATION_NAME = "_services._dns-sd._udp.local.";
Responder.INSTANCES = new Map();
//# sourceMappingURL=Responder.js.map