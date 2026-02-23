import { EventEmitter } from "events";
export type InterfaceName = string;
export type MacAddress = string;
export type IPv4Address = string;
export type IPv6Address = string;
export type IPAddress = IPv4Address | IPv6Address;
export declare const enum IPFamily {
    IPv4 = "IPv4",
    IPv6 = "IPv6"
}
export declare const enum WifiState {
    UNDEFINED = 0,
    NOT_A_WIFI_INTERFACE = 1,
    NOT_ASSOCIATED = 2,
    CONNECTED = 3
}
export interface NetworkInterface {
    name: InterfaceName;
    loopback: boolean;
    mac: MacAddress;
    ipv4?: IPv4Address;
    ip4Netmask?: IPv4Address;
    ipv4Netaddress?: IPv4Address;
    ipv6?: IPv6Address;
    ipv6Netmask?: IPv6Address;
    globallyRoutableIpv6?: IPv6Address;
    globallyRoutableIpv6Netmask?: IPv6Address;
    uniqueLocalIpv6?: IPv6Address;
    uniqueLocalIpv6Netmask?: IPv6Address;
}
export interface NetworkUpdate {
    added?: NetworkInterface[];
    removed?: NetworkInterface[];
    changes?: InterfaceChange[];
}
export interface InterfaceChange {
    name: InterfaceName;
    outdatedIpv4?: IPv4Address;
    updatedIpv4?: IPv4Address;
    outdatedIpv6?: IPv6Address;
    updatedIpv6?: IPv6Address;
    outdatedGloballyRoutableIpv6?: IPv6Address;
    updatedGloballyRoutableIpv6?: IPv6Address;
    outdatedUniqueLocalIpv6?: IPv6Address;
    updatedUniqueLocalIpv6?: IPv6Address;
}
export interface NetworkManagerOptions {
    interface?: (InterfaceName | IPAddress) | (InterfaceName | IPAddress)[];
    excludeIpv6?: boolean;
    excludeIpv6Only?: boolean;
}
export declare const enum NetworkManagerEvent {
    NETWORK_UPDATE = "network-update"
}
export declare interface NetworkManager {
    on(event: "network-update", listener: (networkUpdate: NetworkUpdate) => void): this;
    emit(event: "network-update", networkUpdate: NetworkUpdate): boolean;
}
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
export declare class NetworkManager extends EventEmitter {
    private static readonly SPACE_PATTERN;
    private static readonly NOTHING_FOUND_MESSAGE;
    private static readonly POLLING_TIME;
    private readonly restrictedInterfaces?;
    private readonly excludeIpv6;
    private readonly excludeIpv6Only;
    private currentInterfaces;
    /**
     * A subset of our network interfaces, holding only loopback interfaces (or what node considers "internal").
     */
    private loopbackInterfaces;
    private initPromise?;
    private currentTimer?;
    constructor(options?: NetworkManagerOptions);
    waitForInit(): Promise<void>;
    shutdown(): void;
    getInterfaceMap(): Map<InterfaceName, NetworkInterface>;
    getInterface(name: InterfaceName): NetworkInterface | undefined;
    isLoopbackNetaddressV4(netaddress: IPv4Address): boolean;
    private scheduleNextJob;
    private checkForNewInterfaces;
    private getCurrentNetworkInterfaces;
    static resolveInterface(address: IPAddress): InterfaceName | undefined;
    private static getNetworkInterfaceNames;
    private static assumeNetworkInterfaceNames;
    private static getLoopbackInterface;
    private static getWindowsNetworkInterfaces;
    private static getDarwinNetworkInterfaces;
    private static getLinuxNetworkInterfaces;
    private static getFreeBSDNetworkInterfaces;
    private static getOpenBSD_SUNOS_NetworkInterfaces;
    private static getDarwinWifiNetworkState;
}
//# sourceMappingURL=NetworkManager.d.ts.map