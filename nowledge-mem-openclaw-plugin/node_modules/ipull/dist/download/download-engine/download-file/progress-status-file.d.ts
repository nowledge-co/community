export type ProgressStatus = {
    totalBytes: number;
    totalDownloadParts: number;
    fileName: string;
    comment?: string;
    downloadPart: number;
    transferredBytes: number;
    startTime: number;
    endTime: number;
    transferAction: string;
    downloadStatus: DownloadStatus;
    downloadFlags: DownloadFlags[];
};
export declare enum DownloadStatus {
    Loading = "Loading",
    Active = "Active",
    Paused = "Paused",
    NotStarted = "NotStarted",
    Finished = "Finished",
    Cancelled = "Cancelled",
    Error = "Error"
}
export declare enum DownloadFlags {
    Existing = "Existing",
    DownloadSequence = "DownloadSequence"
}
export default class ProgressStatusFile {
    readonly totalDownloadParts: number;
    readonly fileName: string;
    readonly comment?: string;
    readonly downloadPart: number;
    readonly transferredBytes: number;
    readonly transferAction: string;
    downloadStatus: DownloadStatus;
    downloadFlags: DownloadFlags[];
    totalBytes: number;
    startTime: number;
    endTime: number;
    constructor(totalDownloadParts: number, fileName: string, transferAction?: string, downloadFlags?: DownloadFlags[], comment?: string, downloadPart?: number, transferredBytes?: number, downloadStatus?: DownloadStatus);
    started(): void;
    finished(): void;
    createStatus(downloadPart: number, transferredBytes: number, totalBytes?: number, downloadStatus?: DownloadStatus, comment?: string | undefined): ProgressStatusFile;
}
