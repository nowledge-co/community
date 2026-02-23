import type { Logger } from '@slack/logger';
import type { AckFn, ResponseAck } from '../types';
export type SocketModeResponseBody = any;
type SocketModeClientAck = (response?: Record<string, unknown>) => Promise<void>;
export interface AckArgs {
    logger: Logger;
    socketModeClientAck: SocketModeClientAck;
}
export declare class SocketModeResponseAck implements ResponseAck {
    private logger;
    private isAcknowledged;
    private socketModeClientAck;
    constructor(args: AckArgs);
    bind(): AckFn<SocketModeResponseBody>;
}
export {};
//# sourceMappingURL=SocketModeResponseAck.d.ts.map