import { CiaoService } from "./CiaoService";
import { DNSPacket, DNSProbeQueryDefinition, DNSQueryDefinition, DNSResponseDefinition } from "./coder/DNSPacket";
import { InterfaceName, NetworkManager } from "./NetworkManager";
export interface EndpointInfo {
    address: string;
    port: number;
    interface: string;
}
export interface SendFulfilledResult {
    status: "fulfilled";
    interface: InterfaceName;
}
export interface SendRejectedResult {
    status: "rejected";
    interface: InterfaceName;
    reason: Error;
}
export interface SendTimeoutResult {
    status: "timeout";
    interface: InterfaceName;
}
export type SendResult = SendFulfilledResult | SendRejectedResult;
export type TimedSendResult = SendFulfilledResult | SendRejectedResult | SendTimeoutResult;
export type SendCallback = (error?: Error | null) => void;
/**
 * Returns the ration of rejected SendResults in the array.
 * A ratio of 0 indicates all sends were successful.
 * A ration of 1 indicates all sends failed.
 * A number in between signals that some of the sends failed.
 *
 * @param results - Array of {@link SendResult}
 */
export declare function SendResultFailedRatio(results: SendResult[] | TimedSendResult[]): number;
export declare function SendResultFormatError(results: SendResult[] | TimedSendResult[], prefix?: string, includeStack?: boolean): string;
/**
 * Defines the options passed to the underlying mdns server.
 */
export interface MDNSServerOptions {
    /**
     * If specified, the mdns server will only listen on the specified interfaces (allowlist).
     * It can be supplied as a string (representing a single interface) or as an array of strings
     * to define multiple interfaces.
     * The interface can be defined by specifying the interface name (like 'en0') or
     * by specifying an ip address.
     */
    interface?: string | string[];
    /**
     * If specified, the mdns server will not include any IPv6 (AAAA) address records.
     * This option does not affect advertising on IPv6. Defaults to false.
     */
    disableIpv6?: boolean;
    /**
     * Do not advertise on IPv6-only networks. Defaults to false.
     */
    excludeIpv6Only?: boolean;
    /**
     * If specified, the mDNS server will advertise on IPv4.
     * Defaults to true.
     */
    advertiseIpv4?: boolean;
    /**
     * If specified, the mDNS server will advertise on IPv6.
     * Defaults to true.
     */
    advertiseIpv6?: boolean;
}
export interface PacketHandler {
    handleQuery(packet: DNSPacket, rinfo: EndpointInfo): void;
    handleResponse(packet: DNSPacket, rinfo: EndpointInfo): void;
}
/**
 * This class can be used to create a mdns server to send and receive mdns packets on the local network.
 *
 * Currently only udp4 sockets will be advertised.
 */
export declare class MDNSServer {
    static readonly DEFAULT_IP4_HEADER = 20;
    static readonly DEFAULT_IP6_HEADER = 40;
    static readonly UDP_HEADER = 8;
    static readonly MDNS_PORT = 5353;
    static readonly MDNS_TTL = 255;
    static readonly MULTICAST_IPV4 = "224.0.0.251";
    static readonly MULTICAST_IPV6 = "FF02::FB";
    static readonly SEND_TIMEOUT = 200;
    private readonly handler;
    private readonly networkManager;
    private readonly sockets;
    private readonly sentPackets;
    private suppressUnicastResponseFlag;
    private bound;
    private closed;
    private advertiseFamilies;
    constructor(handler: PacketHandler, options?: MDNSServerOptions);
    getNetworkManager(): NetworkManager;
    getBoundInterfaceNames(): IterableIterator<InterfaceName>;
    bind(): Promise<void>;
    shutdown(): void;
    sendQueryBroadcast(query: DNSQueryDefinition | DNSProbeQueryDefinition, service: CiaoService): Promise<TimedSendResult[]>;
    sendResponseBroadcast(response: DNSResponseDefinition, service: CiaoService): Promise<TimedSendResult[]>;
    sendResponse(response: DNSPacket, endpoint: EndpointInfo, callback?: SendCallback): void;
    sendResponse(response: DNSPacket, interfaceName: InterfaceName, callback?: SendCallback): void;
    private sendOnAllNetworksForService;
    send(packet: DNSPacket, endpointOrInterface: EndpointInfo | InterfaceName): Promise<SendResult>;
    private checkUnicastResponseFlag;
    private assertBeforeSend;
    private maintainSentPacketsInterface;
    private checkIfPacketWasPreviouslySentFromUs;
    private createDgramSocket;
    private bindSocket;
    private handleMessage;
    private static isSilencedSocketError;
    private static logSocketError;
    private handleUpdatedNetworkInterfaces;
}
//# sourceMappingURL=MDNSServer.d.ts.map