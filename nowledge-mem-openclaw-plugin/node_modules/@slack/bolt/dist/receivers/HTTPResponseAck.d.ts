/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from '@slack/logger';
import type { AckFn, ResponseAck, StringIndexed } from '../types';
import * as httpFunc from './HTTPModuleFunctions';
export interface AckArgs {
    logger: Logger;
    processBeforeResponse: boolean;
    unhandledRequestHandler?: (args: httpFunc.ReceiverUnhandledRequestHandlerArgs) => void;
    unhandledRequestTimeoutMillis?: number;
    httpRequest: IncomingMessage;
    httpRequestBody?: StringIndexed;
    httpResponse: ServerResponse;
}
export type HTTResponseBody = any;
export declare class HTTPResponseAck implements ResponseAck {
    private logger;
    private isAcknowledged;
    private processBeforeResponse;
    private unhandledRequestHandler;
    private unhandledRequestTimeoutMillis;
    private unhandledFunctionRequestTimeoutMillis;
    private httpRequest;
    private httpRequestBody;
    private httpResponse;
    private noAckTimeoutId?;
    storedResponse: any;
    constructor(args: AckArgs);
    private init;
    private determineRequestTimeout;
    bind(): AckFn<HTTResponseBody>;
    ack(): void;
}
//# sourceMappingURL=HTTPResponseAck.d.ts.map