/// <reference types="node" />
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Logger } from '@slack/logger';
import { type CodedError } from '../errors';
import type { BufferedIncomingMessage } from './BufferedIncomingMessage';
export declare const extractRetryNumFromHTTPRequest: (req: IncomingMessage) => number | undefined;
export declare const extractRetryReasonFromHTTPRequest: (req: IncomingMessage) => string | undefined;
export declare const parseHTTPRequestBody: (req: BufferedIncomingMessage) => any;
export declare const parseAndVerifyHTTPRequest: (options: RequestVerificationOptions, req: IncomingMessage, _res?: ServerResponse) => Promise<BufferedIncomingMessage>;
export declare const isBufferedIncomingMessage: (req: IncomingMessage) => req is BufferedIncomingMessage;
export declare const getHeader: (req: IncomingMessage, header: string) => string;
export declare const bufferIncomingMessage: (req: IncomingMessage) => Promise<BufferedIncomingMessage>;
export declare const buildNoBodyResponse: (res: ServerResponse, status: number) => void;
export declare const buildUrlVerificationResponse: (res: ServerResponse, body: any) => void;
export declare const buildSSLCheckResponse: (res: ServerResponse) => void;
export declare const buildContentResponse: (res: ServerResponse, body: any) => void;
export declare const defaultDispatchErrorHandler: (args: ReceiverDispatchErrorHandlerArgs) => void;
export declare const defaultAsyncDispatchErrorHandler: (args: ReceiverDispatchErrorHandlerArgs) => Promise<void>;
export declare const defaultProcessEventErrorHandler: (args: ReceiverProcessEventErrorHandlerArgs) => Promise<boolean>;
export declare const defaultUnhandledRequestHandler: (args: ReceiverUnhandledRequestHandlerArgs) => void;
export interface RequestVerificationOptions {
    enabled?: boolean;
    signingSecret: string;
    nowMilliseconds?: () => number;
    logger?: Logger;
}
export interface ReceiverDispatchErrorHandlerArgs {
    error: Error | CodedError;
    logger: Logger;
    request: IncomingMessage;
    response: ServerResponse;
}
export interface ReceiverProcessEventErrorHandlerArgs {
    error: Error | CodedError;
    logger: Logger;
    request: IncomingMessage;
    response: ServerResponse;
    storedResponse: any;
}
export interface ReceiverUnhandledRequestHandlerArgs {
    logger: Logger;
    request: IncomingMessage;
    response: ServerResponse;
}
//# sourceMappingURL=HTTPModuleFunctions.d.ts.map