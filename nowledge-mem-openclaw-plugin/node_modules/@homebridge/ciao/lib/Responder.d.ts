import { CiaoService, ServiceOptions } from "./CiaoService";
import { DNSPacket } from "./coder/DNSPacket";
import { EndpointInfo, MDNSServerOptions, PacketHandler } from "./MDNSServer";
export type ResponderOptions = {
    /**
     * @private
     */
    periodicBroadcasts?: boolean;
    /**
     * @private
     */
    ignoreUnicastResponseFlag?: boolean;
} & MDNSServerOptions;
/**
 * A Responder instance represents a running MDNSServer and a set of advertised services.
 *
 * It will handle any service related operations, like advertising, sending goodbye packets or sending record updates.
 * It handles answering questions arriving at the multicast address.
 */
export declare class Responder implements PacketHandler {
    /**
     * @private
     */
    static readonly SERVICE_TYPE_ENUMERATION_NAME = "_services._dns-sd._udp.local.";
    private static readonly INSTANCES;
    private readonly server;
    private promiseChain;
    private refCount;
    private optionsString;
    private bound;
    /**
     * Announced services is indexed by the {@link dnsLowerCase} if the fqdn (as of RFC 1035 3.1).
     * As soon as the probing step is finished the service is added to the announced services Map.
     */
    private readonly announcedServices;
    /**
     * map representing all our shared PTR records.
     * Typically, we hold stuff like '_services._dns-sd._udp.local' (RFC 6763 9.), '_hap._tcp.local'.
     * Also, pointers for every subtype like '_printer._sub._http._tcp.local' are inserted here.
     *
     * For every pointer we may hold multiple entries (like multiple services can advertise on _hap._tcp.local).
     * The key as well as all values are {@link dnsLowerCase}
     */
    private readonly servicePointer;
    private readonly truncatedQueries;
    private readonly delayedMulticastResponses;
    private currentProber?;
    private readonly ignoreUnicastResponseFlag?;
    private broadcastInterval?;
    /**
     * Refer to {@link getResponder} in the index file
     *
     * @private should not be used directly. Please use the getResponder method defined in index file.
     */
    static getResponder(options?: ResponderOptions): Responder;
    private constructor();
    private handlePeriodicBroadcasts;
    /**
     * Creates a new CiaoService instance and links it to this Responder instance.
     *
     * @param {ServiceOptions} options - Defines all information about the service which should be created.
     * @returns The newly created {@link CiaoService} instance can be used to advertise and manage the created service.
     */
    createService(options: ServiceOptions): CiaoService;
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
    shutdown(): Promise<void>;
    getAnnouncedServices(): IterableIterator<CiaoService>;
    private start;
    private advertiseService;
    private republishService;
    private unpublishService;
    private clearService;
    private addPTR;
    private removePTR;
    private probe;
    private announce;
    private handleServiceRecordUpdate;
    private handleServiceRecordUpdateOnInterface;
    private goodbye;
    private handleNetworkUpdate;
    /**
     * @private method called by the MDNSServer when an incoming query needs ot be handled
     */
    handleQuery(packet: DNSPacket, endpoint: EndpointInfo): void;
    /**
     * @private method called by the MDNSServer when an incoming response needs to be handled
     */
    handleResponse(packet: DNSPacket, endpoint: EndpointInfo): void;
    private static checkRecordConflictType;
    private enqueueDelayedMulticastResponse;
    private answerQuestion;
    private static answerServiceQuestion;
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
    private static addAddressRecords;
}
//# sourceMappingURL=Responder.d.ts.map