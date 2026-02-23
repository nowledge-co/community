import { ServiceType } from "../CiaoService";
import { Protocol } from "../index";
export interface PTRQueryDomain {
    domain: string;
    protocol: Protocol;
    type: ServiceType | string;
}
export interface InstanceNameDomain {
    domain: string;
    protocol: Protocol;
    type: ServiceType | string;
    name: string;
}
export interface SubTypedNameDomain {
    domain: string;
    protocol: Protocol;
    type: ServiceType | string;
    subtype: ServiceType | string;
}
export interface FQDNParts {
    name?: string;
    type: ServiceType | string;
    protocol?: Protocol;
    domain?: string;
}
export interface SubTypePTRParts {
    subtype: ServiceType | string;
    type: ServiceType | string;
    protocol?: Protocol;
    domain?: string;
}
export declare function parseFQDN(fqdn: string): PTRQueryDomain | InstanceNameDomain | SubTypedNameDomain;
export declare function stringify(parts: FQDNParts | SubTypePTRParts): string;
export declare function formatHostname(hostname: string, domain?: string): string;
export declare function removeTLD(hostname: string): string;
export declare function formatMappedIPv4Address(address: string): string;
export declare function enlargeIPv6(address: string): string;
export declare function shortenIPv6(address: string | string[]): string;
export declare function formatReverseAddressPTRName(address: string): string;
export declare function ipAddressFromReversAddressName(name: string): string;
export declare function getNetAddress(address: string, netmask: string): string;
//# sourceMappingURL=domain-formatter.d.ts.map