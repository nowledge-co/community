import retry from "async-retry";
import { EventEmitter } from "eventemitter3";
import { AvailablePrograms } from "../../download-file/download-programs/switch-program.js";
import StatusCodeError from "./errors/status-code-error.js";
export declare const MIN_LENGTH_FOR_MORE_INFO_REQUEST: number;
export type BaseDownloadEngineFetchStreamOptions = {
    retry?: retry.Options;
    /**
     * If true, the engine will retry the request if the server returns a status code between 500 and 599
     */
    retryOnServerError?: boolean;
    headers?: Record<string, string>;
    /**
     * If true, parallel download will be enabled even if the server does not return `accept-range` header, this is good when using cross-origin requests
     */
    acceptRangeIsKnown?: boolean;
    ignoreIfRangeWithQueryParams?: boolean;
} & ({
    defaultFetchDownloadInfo?: {
        length: number;
        acceptRange: boolean;
    };
} | {
    /**
     * Try different headers to see if any authentication is needed
     */
    tryHeaders?: Record<string, string>[];
    /**
     * Delay between trying different headers
     */
    tryHeadersDelay?: number;
});
export type DownloadInfoResponse = {
    length: number;
    acceptRange: boolean;
    newURL?: string;
    fileName?: string;
};
export type FetchSubState = {
    url: string;
    startChunk: number;
    endChunk: number;
    totalSize: number;
    chunkSize: number;
    rangeSupport?: boolean;
    onProgress?: (length: number) => void;
};
export type BaseDownloadEngineFetchStreamEvents = {
    paused: () => void;
    resumed: () => void;
    aborted: () => void;
    errorCountIncreased: (errorCount: number, error: Error) => void;
};
export type WriteCallback = (data: Uint8Array[], position: number, index: number) => void;
export default abstract class BaseDownloadEngineFetchStream extends EventEmitter<BaseDownloadEngineFetchStreamEvents> {
    readonly programType?: AvailablePrograms;
    abstract readonly transferAction: string;
    readonly options: Partial<BaseDownloadEngineFetchStreamOptions>;
    state: FetchSubState;
    paused?: Promise<void>;
    aborted: boolean;
    protected _pausedResolve?: () => void;
    errorCount: {
        value: number;
    };
    constructor(options?: Partial<BaseDownloadEngineFetchStreamOptions>);
    protected get _startSize(): number;
    protected get _endSize(): number;
    protected initEvents(): void;
    abstract withSubState(state: FetchSubState): this;
    protected cloneState<Fetcher extends BaseDownloadEngineFetchStream>(state: FetchSubState, fetchStream: Fetcher): Fetcher;
    fetchDownloadInfo(url: string): Promise<DownloadInfoResponse>;
    protected abstract fetchDownloadInfoWithoutRetry(url: string): Promise<DownloadInfoResponse>;
    fetchChunks(callback: WriteCallback): Promise<void>;
    protected abstract fetchWithoutRetryChunks(callback: WriteCallback): Promise<void> | void;
    close(): void | Promise<void>;
    protected appendToURL(url: string): string;
    protected retryOnServerError(error: Error): error is StatusCodeError;
}
