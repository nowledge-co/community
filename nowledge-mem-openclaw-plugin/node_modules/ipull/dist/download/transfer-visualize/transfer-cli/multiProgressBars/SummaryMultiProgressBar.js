import { BaseMultiProgressBar } from "./BaseMultiProgressBar.js";
import { DownloadFlags, DownloadStatus } from "../../../download-engine/download-file/progress-status-file.js";
export class SummaryMultiProgressBar extends BaseMultiProgressBar {
    printType = "update";
    updateIntervalMs = 0;
    _parallelDownloads = 0;
    _lastStatuses = [];
    createMultiProgressBar(statuses, oneStatus) {
        oneStatus = structuredClone(oneStatus);
        oneStatus.downloadFlags.push(DownloadFlags.DownloadSequence);
        const linesToPrint = [];
        let index = 0;
        for (const status of statuses) {
            const isStatusChanged = this._lastStatuses[index++]?.downloadStatus !== status.downloadStatus;
            const copyStatus = structuredClone(status);
            if (isStatusChanged) {
                linesToPrint.push(copyStatus);
            }
        }
        if (this.printType === "log") {
            this._lastStatuses = structuredClone(statuses);
        }
        const { allStatusesSorted } = this.recorderStatusByImportance(linesToPrint);
        const filterStatusesSliced = allStatusesSorted.slice(0, this.options.maxViewDownloads);
        if (statuses.length > 1 || oneStatus.downloadStatus === DownloadStatus.Active) {
            filterStatusesSliced.push(oneStatus);
        }
        const activeDownloads = statuses.filter((status) => status.downloadStatus === DownloadStatus.Active).length;
        this._parallelDownloads ||= activeDownloads;
        const finishedDownloads = statuses.filter((status) => status.downloadStatus === DownloadStatus.Finished).length;
        oneStatus.comment = `${finishedDownloads}/${statuses.length} files done${this._parallelDownloads > 1 ? ` (${activeDownloads} active)` : ""}`;
        return this.createProgresses(filterStatusesSliced);
    }
}
//# sourceMappingURL=SummaryMultiProgressBar.js.map