import { CiaoService } from "../CiaoService";
import { MDNSServer } from "../MDNSServer";
export interface AnnouncerOptions {
    /**
     * Defines how often the announcement should be sent.
     */
    repetitions?: number;
    /**
     * If set to true, goodbye packets will be sent (ttl will be set to zero on all records)
     */
    goodbye?: boolean;
}
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
export declare class Announcer {
    static readonly CANCEL_REASON = "CIAO ANNOUNCEMENT CANCELLED";
    private readonly server;
    private readonly service;
    private readonly repetitions;
    private readonly announceIntervalIncreaseFactor;
    private readonly goodbye;
    private timer?;
    private promise?;
    private promiseResolve?;
    private promiseReject?;
    private sentAnnouncements;
    private sentLastAnnouncement;
    private nextInterval;
    nextAnnouncementTime: number;
    constructor(server: MDNSServer, service: CiaoService, options: AnnouncerOptions);
    announce(): Promise<void>;
    cancel(): Promise<void>;
    hasSentLastAnnouncement(): boolean;
    awaitAnnouncement(): Promise<void>;
    isSendingGoodbye(): boolean;
    private sendAnnouncement;
    private static sendResponseAddingAddressRecords;
}
//# sourceMappingURL=Announcer.d.ts.map