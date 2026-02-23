import chalk from "chalk";
import { PRETTY_MS_OPTIONS } from "../../format-transfer-status.js";
import { renderDataLine } from "../../utils/data-line.js";
import prettyMilliseconds from "pretty-ms";
import sliceAnsi from "slice-ansi";
import stripAnsi from "strip-ansi";
import { DownloadStatus } from "../../../download-engine/download-file/progress-status-file.js";
import BaseTransferCliProgressBar from "./base-transfer-cli-progress-bar.js";
import { STATUS_ICONS } from "../../utils/progressBarIcons.js";
/**
 * A class to display transfer progress in the terminal, with a progress bar and other information.
 */
export default class FancyTransferCliProgressBar extends BaseTransferCliProgressBar {
    renderProgressLine() {
        const { formattedSpeed, formatTransferred, formatTotal, formattedPercentage, percentage } = this.status;
        const formattedPercentageWithPadding = formattedPercentage.padEnd(6, " ");
        const progressBarText = ` ${formattedPercentageWithPadding} (${formatTransferred}/${formatTotal}) `;
        const dimEta = this.getETA(" | ", text => chalk.dim(text));
        return renderDataLine([{
                type: "status",
                fullText: "",
                size: 1,
                formatter: () => STATUS_ICONS.activeDownload
            }, {
                type: "spacer",
                fullText: " ",
                size: " ".length
            }, ...this.getNameAndCommentDataParts(), {
                type: "spacer",
                fullText: " ",
                size: " ".length
            }, {
                type: "progressBar",
                fullText: progressBarText,
                size: Math.max(progressBarText.length, `100.0% (1024.00MB/${formatTotal})`.length),
                flex: 4,
                addEndPadding: 4,
                maxSize: 40,
                formatter(_, size) {
                    const leftPad = " ".repeat(Math.floor((size - progressBarText.length) / 2));
                    return renderProgressBar({
                        barText: leftPad + ` ${chalk.black.bgWhiteBright(formattedPercentageWithPadding)} ${chalk.gray(`(${formatTransferred}/${formatTotal})`)} `,
                        backgroundText: leftPad + ` ${chalk.yellow.bgGray(formattedPercentageWithPadding)} ${chalk.white(`(${formatTransferred}/${formatTotal})`)} `,
                        length: size,
                        loadedPercentage: percentage / 100,
                        barStyle: chalk.black.bgWhiteBright,
                        backgroundStyle: chalk.bgGray
                    });
                }
            }, {
                type: "spacer",
                fullText: " ",
                size: " ".length
            }, {
                type: "speed",
                fullText: formattedSpeed,
                size: Math.max("00.00kB/s".length, formattedSpeed.length)
            }, ...dimEta]);
    }
    renderFinishedLine() {
        const wasSuccessful = this.status.downloadStatus === DownloadStatus.Finished;
        const { endTime, startTime } = this.status;
        const downloadTime = (endTime || Date.now()) - startTime;
        const finishedText = wasSuccessful
            ? `downloaded ${this.status.formatTransferred} in ${prettyMilliseconds(downloadTime, PRETTY_MS_OPTIONS)}`
            : `failed downloading after ${prettyMilliseconds(endTime - startTime, PRETTY_MS_OPTIONS)}`;
        return renderDataLine([{
                type: "status",
                fullText: "",
                size: 1,
                formatter: () => (wasSuccessful
                    ? STATUS_ICONS.done
                    : STATUS_ICONS.failed)
            }, {
                type: "spacer",
                fullText: " ",
                size: " ".length,
                formatter: (text) => text
            }, ...this.getNameAndCommentDataParts(), {
                type: "spacer",
                fullText: " ",
                size: " ".length,
                formatter: (text) => text
            }, {
                type: "description",
                fullText: finishedText,
                size: finishedText.length,
                formatter: (text) => chalk.dim(text)
            }]);
    }
    renderPendingLine() {
        const pendingText = `will download ${this.status.formatTotal}`;
        return renderDataLine([{
                type: "status",
                fullText: "",
                size: 1,
                formatter: () => STATUS_ICONS.pending
            }, {
                type: "spacer",
                fullText: " ",
                size: " ".length,
                formatter: (text) => text
            }, ...this.getNameAndCommentDataParts(), {
                type: "spacer",
                fullText: " ",
                size: " ".length,
                formatter: (text) => text
            }, {
                type: "description",
                fullText: pendingText,
                size: pendingText.length,
                formatter: (text) => chalk.dim(text)
            }]);
    }
}
function renderProgressBar({ barText, backgroundText, length, loadedPercentage, barStyle, backgroundStyle }) {
    const barChars = Math.floor(length * loadedPercentage);
    const backgroundChars = length - barChars;
    const slicedBarText = sliceAnsi(barText, 0, barChars);
    const paddedBarText = slicedBarText + " ".repeat(barChars - stripAnsi(slicedBarText).length);
    const slicedBackgroundText = sliceAnsi(backgroundText, barChars, barChars + backgroundChars);
    const paddedBackgroundText = slicedBackgroundText + " ".repeat(backgroundChars - stripAnsi(slicedBackgroundText).length);
    return barStyle(paddedBarText) + backgroundStyle(paddedBackgroundText);
}
//# sourceMappingURL=fancy-transfer-cli-progress-bar.js.map