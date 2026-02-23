"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Announcer = void 0;
const tslib_1 = require("tslib");
const assert_1 = tslib_1.__importDefault(require("assert"));
const debug_1 = tslib_1.__importDefault(require("debug"));
const DNSPacket_1 = require("../coder/DNSPacket");
const MDNSServer_1 = require("../MDNSServer");
const promise_utils_1 = require("../util/promise-utils");
const debug = (0, debug_1.default)("ciao:Announcer");
/**
 * This class is used to execute the 'announce' process for a given service as define in RFC 6762 8.3.
 *
 * The Multicast DNS responder MUST send at least two unsolicited
 * responses, one second apart.  To provide increased robustness against
 * packet loss, a responder MAY send up to eight unsolicited responses,
 * provided that the interval between unsolicited responses increases by
 * at least a factor of two with every response sent.
 *
 */
class Announcer {
    constructor(server, service, options) {
        this.repetitions = 1;
        this.announceIntervalIncreaseFactor = 2; // RFC states a factor of AT LEAST two (could be higher as it seems)
        this.goodbye = false;
        this.sentAnnouncements = 0;
        this.sentLastAnnouncement = false;
        this.nextInterval = 1000;
        this.nextAnnouncementTime = 0;
        (0, assert_1.default)(server, "server must be defined");
        (0, assert_1.default)(service, "service must be defined");
        this.server = server;
        this.service = service;
        if (options) {
            if (options.repetitions !== undefined) {
                this.repetitions = options.repetitions;
            }
            if (options.goodbye) {
                this.goodbye = true;
            }
        }
        (0, assert_1.default)(this.repetitions > 0 && this.repetitions <= 8, "repetitions must in [1;8]");
    }
    announce() {
        debug("[%s] Sending %s for service", this.service.getFQDN(), this.goodbye ? "goodbye" : "announcement");
        if (!this.goodbye) {
            // could happen that the txt record was updated while probing.
            // just to be sure to announce all the latest data, we will rebuild the services.
            this.service.rebuildServiceRecords();
        }
        return (this.promise = new Promise((resolve, reject) => {
            this.promiseResolve = resolve;
            this.promiseReject = reject;
            this.timer = setTimeout(this.sendAnnouncement.bind(this), 0);
            this.timer.unref();
            this.nextAnnouncementTime = new Date().getTime();
        }));
    }
    async cancel() {
        debug("[%s] Canceling %s", this.service.getFQDN(), this.goodbye ? "goodbye" : "announcement");
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }
        this.promiseReject(Announcer.CANCEL_REASON);
        // the promise handlers are not called instantly, thus we give the opportunity to wait for the
        // program originally doing the announcement to clean up
        return this.awaitAnnouncement().catch(reason => {
            if (reason !== Announcer.CANCEL_REASON) {
                return Promise.reject(reason);
            }
        });
    }
    hasSentLastAnnouncement() {
        return this.sentLastAnnouncement;
    }
    async awaitAnnouncement() {
        await this.promise;
    }
    isSendingGoodbye() {
        return this.goodbye;
    }
    sendAnnouncement() {
        // minimum required is to send two unsolicited responses, one second apart
        // we could announce up to 8 times in total (time between messages must increase by two every message)
        debug("[%s] Sending %s number %d", this.service.getFQDN(), this.goodbye ? "goodbye" : "announcement", this.sentAnnouncements + 1);
        // we rebuild every time,
        const records = [
            this.service.ptrRecord(), ...this.service.subtypePtrRecords(),
            this.service.srvRecord(), this.service.txtRecord(),
            // A and AAAA records are added below when sending. Which records get added depends on the network the announcement happens for
        ];
        if (this.goodbye) {
            for (const record of records) {
                record.ttl = 0; // setting ttl to zero to indicate "goodbye"
            }
        }
        else {
            records.push(this.service.metaQueryPtrRecord());
        }
        if (this.sentAnnouncements + 1 >= this.repetitions) {
            this.sentLastAnnouncement = true;
        }
        Announcer.sendResponseAddingAddressRecords(this.server, this.service, records, this.goodbye).then(results => {
            const failRatio = (0, MDNSServer_1.SendResultFailedRatio)(results);
            if (failRatio === 1) {
                console.error((0, MDNSServer_1.SendResultFormatError)(results, `[${this.service.getFQDN()}] Failed to send ${this.goodbye ? "goodbye" : "announcement"} requests`), true);
                this.promiseReject(new Error(`${this.goodbye ? "Goodbye" : "Announcement"} failed as of socket errors!`));
                return; // all failed => thus announcement failed
            }
            if (failRatio > 0) {
                // some queries on some interfaces failed, but not all. We log that but consider that to be a success
                // at this point we are not responsible for removing stale network interfaces or something
                debug((0, MDNSServer_1.SendResultFormatError)(results, `Some of the ${this.goodbye ? "goodbye" : "announcement"} requests for '${this.service.getFQDN()}' encountered an error`));
                // SEE no return here
            }
            if (this.service.serviceState !== "announcing" /* ServiceState.ANNOUNCING */) {
                debug("[%s] Service is no longer in announcing state. Stopping. (Received %s)", this.service.getFQDN(), this.service.serviceState);
                return;
            }
            this.sentAnnouncements++;
            if (this.sentAnnouncements >= this.repetitions) {
                this.promiseResolve();
            }
            else {
                this.timer = setTimeout(this.sendAnnouncement.bind(this), this.nextInterval);
                this.timer.unref();
                this.nextAnnouncementTime = new Date().getTime() + this.nextInterval;
                this.nextInterval *= this.announceIntervalIncreaseFactor;
            }
        });
    }
    static sendResponseAddingAddressRecords(server, service, records, goodbye) {
        const promises = [];
        for (const name of server.getBoundInterfaceNames()) {
            if (!service.advertisesOnInterface(name)) {
                continue;
            }
            const answer = records.concat([]);
            const aRecord = service.aRecord(name);
            const aaaaRecord = service.aaaaRecord(name);
            const aaaaRoutableRecord = service.aaaaRoutableRecord(name);
            const aaaaUniqueLocalRecord = service.aaaaUniqueLocalRecord(name);
            //const reversMappings: PTRRecord[] = service.reverseAddressMappings(networkInterface);
            const nsecRecord = service.addressNSECRecord();
            const serviceNsecRecord = service.serviceNSECRecord();
            if (aRecord) {
                if (goodbye) {
                    aRecord.ttl = 0;
                }
                answer.push(aRecord);
            }
            if (aaaaRecord) {
                if (goodbye) {
                    aaaaRecord.ttl = 0;
                }
                answer.push(aaaaRecord);
            }
            if (aaaaRoutableRecord) {
                if (goodbye) {
                    aaaaRoutableRecord.ttl = 0;
                }
                answer.push(aaaaRoutableRecord);
            }
            if (aaaaUniqueLocalRecord) {
                if (goodbye) {
                    aaaaUniqueLocalRecord.ttl = 0;
                }
                answer.push(aaaaUniqueLocalRecord);
            }
            /*
            for (const reversMapping of reversMappings) {
              if (goodbye) {
                reversMapping.ttl = 0;
              }
              answer.push(reversMapping);
            }
            */
            if (goodbye) {
                nsecRecord.ttl = 0;
                serviceNsecRecord.ttl = 0;
            }
            const additionals = [];
            additionals.push(nsecRecord, serviceNsecRecord);
            const packet = DNSPacket_1.DNSPacket.createDNSResponsePacketsFromRRSet({
                answers: answer,
                additionals: additionals,
            });
            promises.push(Promise.race([
                server.send(packet, name),
                (0, promise_utils_1.PromiseTimeout)(MDNSServer_1.MDNSServer.SEND_TIMEOUT).then(() => ({
                    status: "timeout",
                    interface: name,
                })),
            ]));
        }
        return Promise.all(promises);
    }
}
exports.Announcer = Announcer;
Announcer.CANCEL_REASON = "CIAO ANNOUNCEMENT CANCELLED";
//# sourceMappingURL=Announcer.js.map