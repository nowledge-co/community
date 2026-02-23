import { CiaoService } from "../CiaoService";
import { DNSPacket } from "../coder/DNSPacket";
import { EndpointInfo, MDNSServer } from "../MDNSServer";
import { Responder } from "../Responder";
/**
 * This class is used to execute the probing process for a given service as defined
 * in RFC 6762 8.1.
 * This ensures that we advertise the service under a unique name.
 * It also provides a conflict resolution algorithm if multiple clients probing
 * for the same name are detected.
 */
export declare class Prober {
    static readonly CANCEL_REASON = "CIAO PROBING CANCELLED";
    private readonly responder;
    private readonly server;
    private readonly service;
    private records;
    private timer?;
    private currentInterval;
    private promiseResolve?;
    private promiseReject?;
    private serviceEncounteredNameChange;
    private sentFirstProbeQuery;
    private sentQueriesForCurrentTry;
    private sentQueries;
    constructor(responder: Responder, server: MDNSServer, service: CiaoService);
    getService(): CiaoService;
    /**
     * This method is called to start the actual probing process.
     * Once the service is considered unique on the network and can be announced the promise returns.
     * While probing multiple name changes can happen
     *
     * @returns a promise which returns when the service is considered unique on the network
     */
    probe(): Promise<void>;
    cancel(): void;
    private clear;
    /**
     * End the current ongoing probing requests. If
     * @param success
     */
    private endProbing;
    private sendProbeRequest;
    private checkLocalConflicts;
    handleResponse(packet: DNSPacket, endpoint: EndpointInfo): void;
    private handleNameChange;
    handleQuery(packet: DNSPacket, endpoint: EndpointInfo): void;
    private doTiebreaking;
}
//# sourceMappingURL=Prober.d.ts.map