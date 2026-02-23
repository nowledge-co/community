import { LogLevel, type Logger } from '@slack/logger';
import type App from '../App';
import type { Receiver } from '../types/receiver';
import type { StringIndexed } from '../types/utilities';
export type AwsEvent = AwsEventV1 | AwsEventV2;
type AwsEventStringParameters = Record<string, string | undefined>;
type AwsEventMultiValueStringParameters = Record<string, string[] | undefined>;
export interface AwsEventV1 {
    body: string | null;
    headers: AwsEventStringParameters;
    isBase64Encoded: boolean;
    pathParameters: AwsEventStringParameters | null;
    queryStringParameters: AwsEventStringParameters | null;
    requestContext: any;
    stageVariables: AwsEventStringParameters | null;
    httpMethod: string;
    multiValueHeaders: AwsEventMultiValueStringParameters;
    multiValueQueryStringParameters: AwsEventMultiValueStringParameters;
    path: string;
    resource: string;
}
export interface AwsEventV2 {
    body?: string;
    headers: AwsEventStringParameters;
    isBase64Encoded: boolean;
    pathParameters?: AwsEventStringParameters;
    queryStringParameters?: AwsEventStringParameters;
    requestContext: any;
    stageVariables?: AwsEventStringParameters;
    cookies?: string[];
    rawPath: string;
    rawQueryString: string;
    routeKey: string;
    version: string;
}
export type AwsCallback = (error?: Error | string | null, result?: any) => void;
export interface ReceiverInvalidRequestSignatureHandlerArgs {
    rawBody: string;
    signature: string;
    ts: number;
    awsEvent: AwsEvent;
    awsResponse: Promise<AwsResponse>;
}
export interface AwsResponse {
    statusCode: number;
    headers?: {
        [header: string]: boolean | number | string;
    };
    multiValueHeaders?: {
        [header: string]: Array<boolean | number | string>;
    };
    body: string;
    isBase64Encoded?: boolean;
}
export type AwsHandler = (event: AwsEvent, context: any, callback: AwsCallback) => Promise<AwsResponse>;
export interface AwsLambdaReceiverOptions {
    /**
     * The Slack Signing secret to be used as an input to signature verification to ensure that requests are coming from
     * Slack.
     *
     * If the {@link signatureVerification} flag is set to `false`, this can be set to any value as signature verification
     * using this secret will not be performed.
     *
     * @see {@link https://api.slack.com/authentication/verifying-requests-from-slack#about} for details about signing secrets
     */
    signingSecret: string;
    /**
     * The {@link Logger} for the receiver
     *
     * @default ConsoleLogger
     */
    logger?: Logger;
    /**
     * The {@link LogLevel} to be used for the logger.
     *
     * @default LogLevel.INFO
     */
    logLevel?: LogLevel;
    /**
     * Flag that determines whether Bolt should {@link https://api.slack.com/authentication/verifying-requests-from-slack|verify Slack's signature on incoming requests}.
     *
     * @default true
     */
    signatureVerification?: boolean;
    /**
     * Optional `function` that can extract custom properties from an incoming receiver event
     * @param request The API Gateway event {@link AwsEvent}
     * @returns An object containing custom properties
     *
     * @default noop
     */
    customPropertiesExtractor?: (request: AwsEvent) => StringIndexed;
    invalidRequestSignatureHandler?: (args: ReceiverInvalidRequestSignatureHandlerArgs) => void;
    unhandledRequestTimeoutMillis?: number;
}
export default class AwsLambdaReceiver implements Receiver {
    private signingSecret;
    private app?;
    private _logger;
    get logger(): Logger;
    private signatureVerification;
    private customPropertiesExtractor;
    private invalidRequestSignatureHandler;
    private unhandledRequestTimeoutMillis;
    constructor({ signingSecret, logger, logLevel, signatureVerification, customPropertiesExtractor, invalidRequestSignatureHandler, unhandledRequestTimeoutMillis, }: AwsLambdaReceiverOptions);
    init(app: App): void;
    start(..._args: any[]): Promise<AwsHandler>;
    stop(..._args: any[]): Promise<void>;
    toHandler(): AwsHandler;
    private getRawBody;
    private parseRequestBody;
    private isValidRequestSignature;
    private getHeaderValue;
    private defaultInvalidRequestSignatureHandler;
}
export {};
//# sourceMappingURL=AwsLambdaReceiver.d.ts.map