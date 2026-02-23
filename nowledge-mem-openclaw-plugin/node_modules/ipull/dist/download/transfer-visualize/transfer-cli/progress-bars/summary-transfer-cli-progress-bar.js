import chalk from "chalk";
import { SummaryMultiProgressBar } from "../multiProgressBars/SummaryMultiProgressBar.js";
import { renderDataLine } from "../../utils/data-line.js";
import FancyTransferCliProgressBar from "./fancy-transfer-cli-progress-bar.js";
import { STATUS_ICONS } from "../../utils/progressBarIcons.js";
import { DownloadFlags } from "../../../download-engine/download-file/progress-status-file.js";
export default class SummaryTransferCliProgressBar extends FancyTransferCliProgressBar {
    multiProgressBar = SummaryMultiProgressBar;
    switchTransferToIcon() {
        switch (this.status.transferAction) {
            case "Downloading":
                return "↓";
            case "Copying":
                return "→";
        }
        return this.status.transferAction;
    }
    getSpinnerText() {
        return STATUS_ICONS.pending;
    }
    renderProgressLine() {
        if (this.status.downloadFlags.includes(DownloadFlags.DownloadSequence)) {
            return this.renderDownloadSequence();
        }
        const pendingText = `downloading ${this.status.formatTotal}`;
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
                type: "description",
                fullText: pendingText,
                size: pendingText.length,
                formatter: (text) => chalk.dim(text)
            }]);
    }
    renderDownloadSequence() {
        const { formatTransferredOfTotal, formattedSpeed, comment, formattedPercentage } = this.status;
        const progressBar = `(${formatTransferredOfTotal})`;
        return renderDataLine([
            {
                type: "status",
                fullText: "",
                size: 1,
                formatter: () => chalk.cyan(this.switchTransferToIcon())
            },
            {
                type: "spacer",
                fullText: " ",
                size: " ".length
            },
            {
                type: "percentage",
                fullText: formattedPercentage,
                size: 6,
                formatter: (text) => text
            },
            {
                type: "spacer",
                fullText: " ",
                size: " ".length
            },
            {
                type: "progressBar",
                fullText: progressBar,
                size: progressBar.length
            },
            {
                type: "spacer",
                fullText: " | ",
                size: " | ".length,
                formatter: (text) => chalk.dim(text)
            },
            {
                type: "nameComment",
                fullText: comment || "",
                size: (comment || "").length
            },
            {
                type: "spacer",
                fullText: " | ",
                size: " | ".length,
                formatter: (text) => chalk.dim(text)
            },
            {
                type: "speed",
                fullText: formattedSpeed,
                size: formattedSpeed.length
            },
            ...this.getETA(" | ")
        ]);
    }
}
//# sourceMappingURL=summary-transfer-cli-progress-bar.js.map