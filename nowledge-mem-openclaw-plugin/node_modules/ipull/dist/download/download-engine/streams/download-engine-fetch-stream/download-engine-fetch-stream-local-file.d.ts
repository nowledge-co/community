import BaseDownloadEngineFetchStream, { DownloadInfoResponse, FetchSubState, WriteCallback } from "./base-download-engine-fetch-stream.js";
export default class DownloadEngineFetchStreamLocalFile extends BaseDownloadEngineFetchStream {
    transferAction: string;
    private _fd;
    private _fsPath;
    withSubState(state: FetchSubState): this;
    private _ensureFileOpen;
    protected fetchWithoutRetryChunks(callback: WriteCallback): Promise<void>;
    protected fetchDownloadInfoWithoutRetry(path: string): Promise<DownloadInfoResponse>;
    close(): void;
}
