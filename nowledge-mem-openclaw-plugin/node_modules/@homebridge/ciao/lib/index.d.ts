import "source-map-support/register";
import "./coder/records/index";
import { Responder, ResponderOptions } from "./Responder";
export * from "./CiaoService";
export * from "./Responder";
export { MDNSServerOptions } from "./MDNSServer";
/**
 * Defines the transport protocol of a service.
 *
 * As of RFC 6763 7. TCP must be used for any applications using tcp.
 *  For applications using any other transport protocol UDP must be used.
 *  This applies to all other transport protocols like SCTP, DCCP, RTMFP, etc
 */
export declare const enum Protocol {
    TCP = "tcp",
    UDP = "udp"
}
/**
 * This method is used to get a responder for the provided (optional) set of options.
 *
 * Ciao tries to create as few Responder instances as possible.
 * Thus, it will share the same Responder instance for the same set of options.
 *
 * @param options - If specified, the options will be passed to the underlying mdns server.
 * @returns A Responder instance for the given options. Might be shared with others using the same options.
 */
export declare function getResponder(options?: ResponderOptions): Responder;
declare const _default: {
    getResponder: typeof getResponder;
};
export default _default;
//# sourceMappingURL=index.d.ts.map