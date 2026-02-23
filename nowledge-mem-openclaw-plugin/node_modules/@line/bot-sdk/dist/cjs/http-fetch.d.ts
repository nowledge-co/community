import { Readable } from "node:stream";
export interface FetchRequestConfig {
    headers?: Record<string, string>;
}
interface httpFetchClientConfig {
    baseURL: string;
    defaultHeaders: Record<string, string>;
}
export declare function convertResponseToReadable(response: Response): Readable;
export declare function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string>;
export declare function mergeHeaders(base: Record<string, string> | undefined, override: Record<string, string> | undefined): Record<string, string>;
export default class HTTPFetchClient {
    private readonly baseURL;
    private readonly defaultHeaders;
    constructor(config: httpFetchClientConfig);
    get<T>(url: string, params?: any): Promise<Response>;
    post(url: string, body?: any, config?: Partial<FetchRequestConfig>): Promise<Response>;
    put(url: string, body?: any, config?: Partial<FetchRequestConfig>): Promise<Response>;
    postForm(url: string, body?: any): Promise<Response>;
    postFormMultipart(url: string, form: FormData): Promise<Response>;
    putFormMultipart(url: string, form: FormData, config?: Partial<FetchRequestConfig>): Promise<Response>;
    postBinaryContent(url: string, body: Blob): Promise<Response>;
    delete(url: string, params?: any): Promise<Response>;
    private checkResponseStatus;
}
export {};
//# sourceMappingURL=http-fetch.d.ts.map