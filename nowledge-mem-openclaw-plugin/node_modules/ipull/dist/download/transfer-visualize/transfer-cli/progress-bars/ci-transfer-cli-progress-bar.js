import SummaryTransferCliProgressBar from "./summary-transfer-cli-progress-bar.js";
import { CIMultiProgressBar } from "../multiProgressBars/CIMultiProgressBar.js";
const MIN_NAME_LENGTH = 80;
export default class CiTransferCliProgressBar extends SummaryTransferCliProgressBar {
    multiProgressBar = CIMultiProgressBar;
    minNameLength = MIN_NAME_LENGTH;
}
//# sourceMappingURL=ci-transfer-cli-progress-bar.js.map