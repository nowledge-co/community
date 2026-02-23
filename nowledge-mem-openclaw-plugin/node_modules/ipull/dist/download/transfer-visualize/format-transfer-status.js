import prettyBytes from "pretty-bytes";
import prettyMilliseconds from "pretty-ms";
import { DownloadStatus } from "../download-engine/download-file/progress-status-file.js";
const DEFAULT_LOCALIZATION = "en-US";
const NUMBER_FORMAT_OPTIONS = {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    minimumIntegerDigits: 3
};
export const PRETTY_MS_OPTIONS = {
    ...NUMBER_FORMAT_OPTIONS,
    keepDecimalsOnWholeSeconds: true,
    secondsDecimalDigits: 2,
    compact: true
};
const PRETTY_BYTES_OPTIONS = { ...NUMBER_FORMAT_OPTIONS, space: false, locale: DEFAULT_LOCALIZATION };
const DEFAULT_CLI_INFO_STATUS = {
    speed: 0,
    transferredBytes: 0,
    totalBytes: 0,
    percentage: 0,
    timeLeft: 0,
    ended: false
};
function formatSpeed(speed) {
    return prettyBytes(Math.min(speed, 9999999999) || 0, PRETTY_BYTES_OPTIONS) + "/s";
}
export function createFormattedStatus(status) {
    if ("formattedSpeed" in status) {
        return status;
    }
    const fullStatus = { ...DEFAULT_CLI_INFO_STATUS, ...status };
    const formattedSpeed = formatSpeed(fullStatus.speed);
    const formatTransferred = prettyBytes(fullStatus.transferredBytes, PRETTY_BYTES_OPTIONS);
    const formatTotal = fullStatus.totalBytes === 0 ? "???" : prettyBytes(fullStatus.totalBytes, PRETTY_BYTES_OPTIONS);
    const formatTransferredOfTotal = `${formatTransferred}/${formatTotal}`;
    const formatTimeLeft = fullStatus.totalBytes === 0 ? "unknown time" : prettyMilliseconds(fullStatus.timeLeft, PRETTY_MS_OPTIONS);
    const formattedPercentage = fullStatus.percentage.toLocaleString(DEFAULT_LOCALIZATION, {
        minimumIntegerDigits: 1,
        minimumFractionDigits: 4
    })
        .slice(0, 5) + "%";
    let fullComment = fullStatus.comment;
    if (status.downloadStatus === DownloadStatus.Cancelled || status.downloadStatus === DownloadStatus.Paused) {
        if (fullComment) {
            fullComment += " | " + status.downloadStatus;
        }
        else {
            fullComment = status.downloadStatus;
        }
    }
    return {
        ...fullStatus,
        formattedSpeed,
        formatTransferred,
        formatTransferredOfTotal,
        formatTotal,
        formatTimeLeft,
        formattedPercentage,
        formattedComment: fullComment ? `(${fullComment})` : ""
    };
}
//# sourceMappingURL=format-transfer-status.js.map