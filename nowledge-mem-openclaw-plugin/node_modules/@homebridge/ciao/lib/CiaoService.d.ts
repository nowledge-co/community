import { EventEmitter } from "events";
import { DNSResponseDefinition } from "./coder/DNSPacket";
import { AAAARecord } from "./coder/records/AAAARecord";
import { ARecord } from "./coder/records/ARecord";
import { NSECRecord } from "./coder/records/NSECRecord";
import { PTRRecord } from "./coder/records/PTRRecord";
import { SRVRecord } from "./coder/records/SRVRecord";
import { TXTRecord } from "./coder/records/TXTRecord";
import { ResourceRecord } from "./coder/ResourceRecord";
import { Protocol } from "./index";
import { InterfaceName, IPAddress, NetworkManager, NetworkUpdate } from "./NetworkManager";
import { Announcer } from "./responder/Announcer";
/**
 * This enum defines some commonly used service types.
 * This is also referred to as service name (as of RFC 6763).
 * A service name must not be longer than 15 characters (RFC 6763 7.2).
 */
export declare const enum ServiceType {
    AIRDROP = "airdrop",
    AIRPLAY = "airplay",
    AIRPORT = "airport",
    COMPANION_LINK = "companion-link",
    DACP = "dacp",// digital audio control protocol (iTunes)
    HAP = "hap",// used by HomeKit accessories
    HOMEKIT = "homekit",// used by home hubs
    HTTP = "http",
    HTTP_ALT = "http_alt",// http alternate
    IPP = "ipp",// internet printing protocol
    IPPS = "ipps",// internet printing protocol over https
    RAOP = "raop",// remote audio output protocol
    scanner = "scanner",// bonjour scanning
    TOUCH_ABLE = "touch-able",// iPhone and iPod touch remote controllable
    DNS_SD = "dns-sd",
    PRINTER = "printer"
}
/**
 * Service options supplied when creating a new ciao service.
 */
export interface ServiceOptions {
    /**
     * Instance name of the service
     */
    name: string;
    /**
     * Type of the service.
     */
    type: ServiceType | string;
    /**
     * Optional array of subtypes of the service.
     * Refer to {@link ServiceType} for some known examples.
     */
    subtypes?: (ServiceType | string)[];
    /**
     * Port of the service.
     * If not supplied it must be set later via {@link CiaoService.updatePort} BEFORE advertising the service.
     */
    port?: number;
    /**
     * The protocol the service uses. Default is TCP.
     */
    protocol?: Protocol;
    /**
     * Defines a hostname under which the service can be reached.
     * The specified hostname must not include the TLD.
     * If undefined the service name will be used as default.
     */
    hostname?: string;
    /**
     * If defined, a txt record will be published with the given service.
     */
    txt?: ServiceTxt;
    /**
     * Adds ability to set custom domain. Will default to "local".
     * The domain will also be automatically appended to the hostname.
     */
    domain?: string;
    /**
     * If defined it restricts the service to be advertised on the specified
     * ip addresses or interface names.
     *
     * If an interface name is specified, ANY address on that given interface will be advertised
     * (if an IP address of the given interface is also given in the array, it will be overridden).
     * If an IP address is specified, the service will only be advertised for the given addresses.
     *
     * Interface names and addresses can be mixed in the array.
     * If an ip address is given, the ip address must be valid at the time of service creation.
     *
     * If the service is set to advertise on a given interface, though the MDNSServer is
     * configured to ignore this interface, the service won't be advertised on the interface.
     */
    restrictedAddresses?: (InterfaceName | IPAddress)[];
    /**
     * The service won't advertise ipv6 address records.
     * This can be used to simulate binding on 0.0.0.0.
     * May be combined with {@link restrictedAddresses}.
     */
    disabledIpv6?: boolean;
}
/**
 * A service txt consist of multiple key=value pairs,
 * which get advertised on the network.
 */
export type ServiceTxt = Record<string, any>;
/**
 * @private
 */
export declare const enum ServiceState {
    UNANNOUNCED = "unannounced",
    PROBING = "probing",
    PROBED = "probed",// service was probed to be unique
    ANNOUNCING = "announcing",// service is in the process of being announced
    ANNOUNCED = "announced"
}
/**
 * @private
 */
export interface ServiceRecords {
    ptr: PTRRecord;
    subtypePTRs?: PTRRecord[];
    metaQueryPtr: PTRRecord;
    srv: SRVRecord;
    txt: TXTRecord;
    serviceNSEC: NSECRecord;
    a: Record<InterfaceName, ARecord>;
    aaaa: Record<InterfaceName, AAAARecord>;
    aaaaR: Record<InterfaceName, AAAARecord>;
    aaaaULA: Record<InterfaceName, AAAARecord>;
    reverseAddressPTRs: Record<IPAddress, PTRRecord>;
    addressNSEC: NSECRecord;
}
/**
 * Events thrown by a CiaoService
 */
export declare const enum ServiceEvent {
    /**
     * Event is called when the Prober identifies that the name for the service is already used
     * and thus resolve the name conflict by adjusting the name (e.g. adding '(2)' to the name).
     * This change must be persisted and thus a listener must hook up to this event
     * in order for the name to be persisted.
     */
    NAME_CHANGED = "name-change",
    /**
     * Event is called when the Prober identifies that the hostname for the service is already used
     * and thus resolve the name conflict by adjusting the hostname (e.g. adding '(2)' to the hostname).
     * The name change must be persisted. As the hostname is an optional parameter, it is derived
     * from the service name if not supplied.
     * If you supply a custom hostname (not automatically derived from the service name) you must
     * hook up a listener to this event in order for the hostname to be persisted.
     */
    HOSTNAME_CHANGED = "hostname-change"
}
/**
 * Events thrown by a CiaoService, internal use only!
 * @private
 */
export declare const enum InternalServiceEvent {
    PUBLISH = "publish",
    UNPUBLISH = "unpublish",
    REPUBLISH = "republish",
    RECORD_UPDATE = "records-update",
    RECORD_UPDATE_ON_INTERFACE = "records-update-interface"
}
/**
 * @private
 */
export type PublishCallback = (error?: Error) => void;
/**
 * @private
 */
export type UnpublishCallback = (error?: Error) => void;
/**
 * @private
 */
export type RecordsUpdateCallback = (error?: Error | null) => void;
export declare interface CiaoService {
    on(event: "name-change", listener: (name: string) => void): this;
    on(event: "hostname-change", listener: (hostname: string) => void): this;
    /**
     * @private
     */
    on(event: InternalServiceEvent.PUBLISH, listener: (callback: PublishCallback) => void): this;
    /**
     * @private
     */
    on(event: InternalServiceEvent.UNPUBLISH, listener: (callback: UnpublishCallback) => void): this;
    /**
     * @private
     */
    on(event: InternalServiceEvent.REPUBLISH, listener: (callback: PublishCallback) => void): this;
    /**
     * @private
     */
    on(event: InternalServiceEvent.RECORD_UPDATE, listener: (response: DNSResponseDefinition, callback?: (error?: Error | null) => void) => void): this;
    /**
     * @private
     */
    on(event: InternalServiceEvent.RECORD_UPDATE_ON_INTERFACE, listener: (name: InterfaceName, records: ResourceRecord[], callback?: RecordsUpdateCallback) => void): this;
    /**
     * @private
     */
    emit(event: ServiceEvent.NAME_CHANGED, name: string): boolean;
    /**
     * @private
     */
    emit(event: ServiceEvent.HOSTNAME_CHANGED, hostname: string): boolean;
    /**
     * @private
     */
    emit(event: InternalServiceEvent.PUBLISH, callback: PublishCallback): boolean;
    /**
     * @private
     */
    emit(event: InternalServiceEvent.UNPUBLISH, callback: UnpublishCallback): boolean;
    /**
     * @private
     */
    emit(event: InternalServiceEvent.REPUBLISH, callback?: PublishCallback): boolean;
    /**
     * @private
     */
    emit(event: InternalServiceEvent.RECORD_UPDATE, response: DNSResponseDefinition, callback?: (error?: Error | null) => void): boolean;
    /**
     * @private
     */
    emit(event: InternalServiceEvent.RECORD_UPDATE_ON_INTERFACE, name: InterfaceName, records: ResourceRecord[], callback?: RecordsUpdateCallback): boolean;
}
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
export declare class CiaoService extends EventEmitter {
    private readonly networkManager;
    private name;
    private readonly type;
    private readonly subTypes?;
    private readonly protocol;
    private readonly serviceDomain;
    private fqdn;
    private loweredFqdn;
    private readonly typePTR;
    private readonly loweredTypePTR;
    private readonly subTypePTRs?;
    private hostname;
    private loweredHostname;
    private port?;
    private readonly restrictedAddresses?;
    private readonly disableIpv6?;
    private txt;
    private txtTimer?;
    /**
     * this field is entirely controlled by the Responder class
     * @private use by the Responder to set the current service state
     */
    serviceState: ServiceState;
    /**
     * If service is in state {@link ServiceState.ANNOUNCING} the {@link Announcer} responsible for the
     * service will be linked here. This is need to cancel announcing when for example the service
     * should be terminated, and we still aren't fully announced yet.
     * @private is controlled by the {@link Responder} instance
     */
    currentAnnouncer?: Announcer;
    private serviceRecords?;
    private destroyed;
    /**
     * Constructs a new service. Please use {@link Responder.createService} to create new service.
     * When calling the constructor a callee must listen to certain events in order to provide
     * correct functionality.
     * @private used by the Responder instance to create a new service
     */
    constructor(networkManager: NetworkManager, options: ServiceOptions);
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
    advertise(): Promise<void>;
    /**
     * This method will remove the advertisement for the service on all connected network interfaces.
     * If the service is still in the Probing state, probing will simply be cancelled.
     *
     * @returns Promise will resolve once the last goodbye packet was sent out
     */
    end(): Promise<void>;
    /**
     * This method must be called if you want to free the memory used by this service.
     * The service instance is not usable anymore after this call.
     *
     * If the service is still announced, the service will first be removed
     * from the network by calling {@link end}.
     *
     * @returns
     */
    destroy(): Promise<void>;
    /**
     * @returns The fully qualified domain name of the service, used to identify the service.
     */
    getFQDN(): string;
    /**
     * @returns The service type pointer.
     */
    getTypePTR(): string;
    /**
     * @returns Array of subtype pointers (undefined if no subtypes are specified).
     */
    getLowerCasedSubtypePTRs(): string[] | undefined;
    /**
     * @returns The current hostname of the service.
     */
    getHostname(): string;
    /**
     * @returns The port the service is advertising for.
     * {@code -1} is returned when the port is not yet set.
     */
    getPort(): number;
    /**
     * @returns The current TXT of the service represented as Buffer array.
     * @private There is not need for this to be public API
     */
    getTXT(): Buffer[];
    /**
     * @private used for internal comparison {@link dnsLowerCase}
     */
    getLowerCasedFQDN(): string;
    /**
     * @private used for internal comparison {@link dnsLowerCase}
     */
    getLowerCasedTypePTR(): string;
    /**
     * @private used for internal comparison {@link dnsLowerCase}
     */
    getLowerCasedHostname(): string;
    /**
     * Sets or updates the txt of the service.
     *
     * @param {ServiceTxt} txt - The updated txt record.
     * @param {boolean} silent - If set to true no announcement is sent for the updated record.
     */
    updateTxt(txt: ServiceTxt, silent?: boolean): void;
    private queueTxtUpdate;
    /**
     * Sets or updates the port of the service.
     * A new port number can only be set when the service is still UNANNOUNCED.
     * Otherwise, an assertion error will be thrown.
     *
     * @param {number} port - The new port number.
     */
    updatePort(port: number): void;
    /**
     * This method updates the name of the service.
     * @param name - The new service name.
     * @private Currently not public API and only used for bonjour conformance testing.
     */
    updateName(name: string): Promise<void>;
    private static txtBuffersFromRecord;
    /**
     * @param networkUpdate
     * @private
     */
    handleNetworkInterfaceUpdate(networkUpdate: NetworkUpdate): void;
    /**
     * This method is called by the Prober when encountering a conflict on the network.
     * It advises the service to change its name, like incrementing a number appended to the name.
     * So "My Service" will become "My Service (2)", and "My Service (2)" would become "My Service (3)"
     * @private must only be called by the {@link Prober}
     */
    incrementName(nameCheckOnly?: boolean): void;
    /**
     * @private called by the Prober once finished with probing to signal a (or more)
     *   name change(s) happened {@see incrementName}.
     */
    informAboutNameUpdates(): void;
    private formatFQDN;
    /**
     * @private called once the service data/state is updated and the records should be updated with the new data
     */
    rebuildServiceRecords(): void;
    /**
     * Returns if the given service is advertising on the provided network interface.
     *
     * @param name - The desired interface name.
     * @param skipAddressCheck - If true it is not checked if the service actually has
     *   an address record for the given interface.
     * @private returns if the service should be advertised on the given service
     */
    advertisesOnInterface(name: InterfaceName, skipAddressCheck?: boolean): boolean;
    /**
     * @private used to get a copy of the main PTR record
     */
    ptrRecord(): PTRRecord;
    /**
     * @private used to get a copy of the array of subtype PTR records
     */
    subtypePtrRecords(): PTRRecord[];
    /**
     * @private used to get a copy of the meta-query PTR record
     */
    metaQueryPtrRecord(): PTRRecord;
    /**
     * @private used to get a copy of the SRV record
     */
    srvRecord(): SRVRecord;
    /**
     * @private used to get a copy of the TXT record
     */
    txtRecord(): TXTRecord;
    /**
     * @private used to get a copy of the A record
     */
    aRecord(name: InterfaceName): ARecord | undefined;
    /**
     * @private used to get a copy of the AAAA record for the link-local ipv6 address
     */
    aaaaRecord(name: InterfaceName): AAAARecord | undefined;
    /**
     * @private used to get a copy of the AAAA record for the routable ipv6 address
     */
    aaaaRoutableRecord(name: InterfaceName): AAAARecord | undefined;
    /**
     * @private used to get a copy of the AAAA for the unique local ipv6 address
     */
    aaaaUniqueLocalRecord(name: InterfaceName): AAAARecord | undefined;
    /**
     * @private used to get a copy of the A and AAAA records
     */
    allAddressRecords(): (ARecord | AAAARecord)[];
    /**
     * @private used to get a copy of the address NSEC record
     */
    addressNSECRecord(): NSECRecord;
    /**
     * @private user to get a copy of the service NSEC record
     */
    serviceNSECRecord(shortenTTL?: boolean): NSECRecord;
    /**
     * @param address - The IP address to check.
     * @private used to check if given address is exposed by this service
     */
    hasAddress(address: IPAddress): boolean;
}
//# sourceMappingURL=CiaoService.d.ts.map