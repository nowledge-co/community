import { SummaryMultiProgressBar } from "../multiProgressBars/SummaryMultiProgressBar.js";
import FancyTransferCliProgressBar from "./fancy-transfer-cli-progress-bar.js";
export default class SummaryTransferCliProgressBar extends FancyTransferCliProgressBar {
    multiProgressBar: typeof SummaryMultiProgressBar;
    switchTransferToIcon(): string;
    getSpinnerText(): string;
    renderProgressLine(): string;
    protected renderDownloadSequence(): string;
}
