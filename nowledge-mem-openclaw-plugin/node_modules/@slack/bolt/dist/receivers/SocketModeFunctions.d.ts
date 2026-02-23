import type { Logger } from '@slack/logger';
import { type CodedError } from '../errors';
import type { ReceiverEvent } from '../types';
export declare function defaultProcessEventErrorHandler(args: SocketModeReceiverProcessEventErrorHandlerArgs): Promise<boolean>;
export interface SocketModeReceiverProcessEventErrorHandlerArgs {
    error: Error | CodedError;
    logger: Logger;
    event: ReceiverEvent;
}
//# sourceMappingURL=SocketModeFunctions.d.ts.map