export type DownloadFilePart = {
    downloadURL?: string;
    acceptRange?: boolean;
    size: number;
};
export declare enum ChunkStatus {
    NOT_STARTED = 0,
    IN_PROGRESS = 1,
    COMPLETE = 2
}
export type SaveProgressInfo = {
    part: number;
    chunks: ChunkStatus[];
    chunkSize: number;
    parallelStreams: number;
};
export type DownloadFile = {
    totalSize: number;
    localFileName: string;
    parts: DownloadFilePart[];
    downloadProgress?: SaveProgressInfo;
};
