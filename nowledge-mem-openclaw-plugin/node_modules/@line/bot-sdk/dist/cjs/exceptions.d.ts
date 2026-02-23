type Message = string;
interface Status {
    status: number;
    statusText: string;
}
interface ErrorDetails {
    signature?: string;
    raw?: any;
}
interface FetchErrorDetails extends Status {
    headers: Headers;
    body: string;
}
interface AxiosErrorDetails {
    originalError: Error;
    code?: string;
    statusCode?: number;
    statusMessage?: string;
}
export declare class SignatureValidationFailed extends Error {
    signature?: string;
    constructor(message: Message, { signature }?: ErrorDetails);
}
export declare class JSONParseError extends Error {
    raw: any;
    constructor(message: Message, { raw }?: ErrorDetails);
}
export declare class RequestError extends Error {
    code: string;
    private originalError;
    constructor(message: Message, { code, originalError }: AxiosErrorDetails);
}
export declare class ReadError extends Error {
    originalError: Error;
    constructor(message: Message, { originalError }: AxiosErrorDetails);
}
export declare class HTTPError extends Error {
    statusCode: number;
    statusMessage: string;
    originalError: any;
    constructor(message: Message, { statusCode, statusMessage, originalError }: AxiosErrorDetails);
}
export declare class HTTPFetchError extends Error {
    status: number;
    statusText: string;
    headers: Headers;
    body: string;
    constructor(message: Message, { status, statusText, headers, body }: FetchErrorDetails);
}
export {};
//# sourceMappingURL=exceptions.d.ts.map