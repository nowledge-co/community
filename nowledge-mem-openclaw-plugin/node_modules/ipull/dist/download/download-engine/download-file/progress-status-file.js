export var DownloadStatus;
(function (DownloadStatus) {
    DownloadStatus["Loading"] = "Loading";
    DownloadStatus["Active"] = "Active";
    DownloadStatus["Paused"] = "Paused";
    DownloadStatus["NotStarted"] = "NotStarted";
    DownloadStatus["Finished"] = "Finished";
    DownloadStatus["Cancelled"] = "Cancelled";
    DownloadStatus["Error"] = "Error";
})(DownloadStatus || (DownloadStatus = {}));
export var DownloadFlags;
(function (DownloadFlags) {
    DownloadFlags["Existing"] = "Existing";
    DownloadFlags["DownloadSequence"] = "DownloadSequence";
})(DownloadFlags || (DownloadFlags = {}));
export default class ProgressStatusFile {
    totalDownloadParts;
    fileName;
    comment;
    downloadPart;
    transferredBytes;
    transferAction;
    downloadStatus = DownloadStatus.Active;
    downloadFlags = [];
    totalBytes = 0;
    startTime = 0;
    endTime = 0;
    constructor(totalDownloadParts, fileName, transferAction = "Transferring", downloadFlags = [], comment, downloadPart = 0, transferredBytes = 0, downloadStatus = DownloadStatus.Active) {
        this.transferAction = transferAction;
        this.transferredBytes = transferredBytes;
        this.downloadPart = downloadPart;
        this.comment = comment;
        this.fileName = fileName;
        this.totalDownloadParts = totalDownloadParts;
        this.downloadFlags = downloadFlags;
        this.downloadStatus = downloadStatus;
    }
    started() {
        this.startTime = Date.now();
    }
    finished() {
        this.endTime = Date.now();
    }
    createStatus(downloadPart, transferredBytes, totalBytes = this.totalBytes, downloadStatus = DownloadStatus.Active, comment = this.comment) {
        const newStatus = new ProgressStatusFile(this.totalDownloadParts, this.fileName, this.transferAction, this.downloadFlags, comment, downloadPart, transferredBytes, downloadStatus);
        newStatus.totalBytes = totalBytes;
        newStatus.startTime = this.startTime;
        newStatus.endTime = this.endTime;
        return newStatus;
    }
}
//# sourceMappingURL=progress-status-file.js.map