import { DownloadStatus } from "../../../download-engine/download-file/progress-status-file.js";
import chalk from "chalk";
import prettyBytes from "pretty-bytes";
export class BaseMultiProgressBar {
    options;
    updateIntervalMs = null;
    printType = "update";
    constructor(options) {
        this.options = options;
    }
    createProgresses(statuses) {
        return statuses.map((status) => {
            status.transferAction = this.options.action ?? status.transferAction;
            return this.options.createProgressBar.createStatusLine(status);
        })
            .join("\n");
    }
    /**
     * Sorts the statuses by importance, active downloads first, then remaining, then finished (by end time - latest first)
     */
    recorderStatusByImportance(statuses) {
        const activeTasks = statuses.filter(status => status.downloadStatus === DownloadStatus.Active);
        const remaining = statuses.filter(status => [DownloadStatus.Paused, DownloadStatus.NotStarted].includes(status.downloadStatus));
        const loading = statuses.filter(status => status.downloadStatus === DownloadStatus.Loading);
        const finishedTasks = statuses.filter(status => status.downloadStatus === DownloadStatus.Finished)
            .sort((a, b) => b.endTime - a.endTime);
        const showTotalTasks = activeTasks.concat(remaining)
            .concat(loading);
        const showTotalTasksWithFinished = showTotalTasks.concat(finishedTasks);
        return {
            notFinished: showTotalTasks.length > 0,
            remaining: remaining.length + loading.length,
            allStatusesSorted: showTotalTasksWithFinished
        };
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    createMultiProgressBar(statuses, oneStatus) {
        if (statuses.length < this.options.maxViewDownloads) {
            return this.createProgresses(statuses);
        }
        const { notFinished, remaining, allStatusesSorted } = this.recorderStatusByImportance(statuses);
        const tasksLogs = this.createProgresses(allStatusesSorted.slice(0, this.options.maxViewDownloads));
        if (notFinished) {
            return tasksLogs + `\nand ${chalk.gray(remaining)} more out of ${chalk.blueBright(statuses.length)} downloads.`;
        }
        const totalSize = allStatusesSorted.reduce((acc, status) => acc + status.totalBytes, 0);
        return tasksLogs + `\n${chalk.green(`All ${statuses.length} downloads (${prettyBytes(totalSize)}) finished.`)}`;
    }
}
//# sourceMappingURL=BaseMultiProgressBar.js.map