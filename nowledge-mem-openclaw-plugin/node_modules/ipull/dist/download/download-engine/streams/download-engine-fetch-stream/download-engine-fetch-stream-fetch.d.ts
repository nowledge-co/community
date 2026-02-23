import BaseDownloadEngineFetchStream, { DownloadInfoResponse, FetchSubState, WriteCallback } from "./base-download-engine-fetch-stream.js";
type GetNextChunk = () => Promise<ReadableStreamReadResult<Uint8Array>> | ReadableStreamReadResult<Uint8Array>;
export default class DownloadEngineFetchStreamFetch extends BaseDownloadEngineFetchStream {
    private _fetchDownloadInfoWithHEAD;
    transferAction: string;
    withSubState(state: FetchSubState): this;
    protected fetchWithoutRetryChunks(callback: WriteCallback): Promise<void>;
    protected fetchDownloadInfoWithoutRetry(url: string): Promise<DownloadInfoResponse>;
    protected fetchDownloadInfoWithoutRetryByMethod(url: string, method?: "HEAD" | "GET"): Promise<DownloadInfoResponse>;
    protected fetchDownloadInfoWithoutRetryContentRange(url: string, response?: Response): Promise<number>;
    chunkGenerator(callback: WriteCallback, getNextChunk: GetNextChunk): Promise<void>;
    protected static convertHeadersToRecord(headers: Headers): {
        [key: string]: string;
    };
}
export {};
