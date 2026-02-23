import type App from '../App';
import type { AckFn } from './index';
import type { StringIndexed } from './utilities';
export interface ReceiverEvent {
    body: StringIndexed;
    retryNum?: number;
    retryReason?: string;
    customProperties?: StringIndexed;
    ack: AckFn<any>;
}
export interface Receiver {
    init(app: App): void;
    start(...args: any[]): Promise<unknown>;
    stop(...args: any[]): Promise<unknown>;
}
export interface ResponseAck {
    bind(): AckFn<any>;
}
//# sourceMappingURL=receiver.d.ts.map