import SummaryTransferCliProgressBar from "./summary-transfer-cli-progress-bar.js";
import { CIMultiProgressBar } from "../multiProgressBars/CIMultiProgressBar.js";
export default class CiTransferCliProgressBar extends SummaryTransferCliProgressBar {
    multiProgressBar: typeof CIMultiProgressBar;
    minNameLength: number;
}
