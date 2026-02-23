import BaseDownloadEngineFetchStream, { DownloadInfoResponse, FetchSubState, WriteCallback } from "./base-download-engine-fetch-stream.js";
import { AvailablePrograms } from "../../download-file/download-programs/switch-program.js";
export default class DownloadEngineFetchStreamXhr extends BaseDownloadEngineFetchStream {
    private _fetchDownloadInfoWithHEAD;
    readonly programType: AvailablePrograms;
    transferAction: string;
    withSubState(state: FetchSubState): this;
    fetchBytes(url: string, start: number, end: number, onProgress?: (length: number) => void): Promise<Uint8Array>;
    protected fetchBytesWithoutRetry(url: string, start: number, end: number, onProgress?: (length: number) => void): Promise<Uint8Array>;
    fetchChunks(callback: WriteCallback): Promise<void>;
    protected fetchWithoutRetryChunks(): Promise<void>;
    protected _fetchChunksRangeSupport(callback: WriteCallback): Promise<void>;
    protected _fetchChunksWithoutRange(callback: WriteCallback): Promise<void>;
    protected fetchDownloadInfoWithoutRetry(url: string): Promise<DownloadInfoResponse>;
    protected fetchDownloadInfoWithoutRetryByMethod(url: string, method?: "HEAD" | "GET"): Promise<DownloadInfoResponse>;
    protected fetchDownloadInfoWithoutRetryContentRange(url: string, xhrResponse?: XMLHttpRequest): number | Promise<number>;
    protected static convertXHRHeadersToRecord(xhr: XMLHttpRequest): Record<string, string>;
}
