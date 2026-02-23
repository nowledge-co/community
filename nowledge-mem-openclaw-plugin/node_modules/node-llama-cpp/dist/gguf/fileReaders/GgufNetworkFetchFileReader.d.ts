import retry from "async-retry";
import { GgufReadOffset } from "../utils/GgufReadOffset.js";
import { ModelFileAccessTokens } from "../../utils/modelFileAccessTokens.js";
import { ModelDownloadEndpoints } from "../../utils/modelDownloadEndpoints.js";
import { GgufFileReader } from "./GgufFileReader.js";
type GgufFetchFileReaderOptions = {
    url: string;
    retryOptions?: retry.Options;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    tokens?: ModelFileAccessTokens;
    endpoints?: ModelDownloadEndpoints;
};
export declare class GgufNetworkFetchFileReader extends GgufFileReader {
    readonly url: string;
    readonly retryOptions: retry.Options;
    readonly headers: Record<string, string>;
    readonly tokens?: ModelFileAccessTokens;
    readonly endpoints?: ModelDownloadEndpoints;
    private readonly _signal?;
    private _tryHeaders;
    constructor({ url, retryOptions, headers, tokens, endpoints, signal }: GgufFetchFileReaderOptions);
    readByteRange(offset: number | GgufReadOffset, length: number): Buffer<ArrayBuffer> | Promise<Buffer<ArrayBuffer>>;
    protected ensureHasByteRange(offset: number | GgufReadOffset, length: number): Promise<void> | undefined;
    private _fetchToExpandBufferUpToOffset;
    private _fetchByteRange;
}
export {};
