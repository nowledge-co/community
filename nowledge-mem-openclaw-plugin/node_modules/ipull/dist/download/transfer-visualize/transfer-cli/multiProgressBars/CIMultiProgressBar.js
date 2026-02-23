import { SummaryMultiProgressBar } from "./SummaryMultiProgressBar.js";
export class CIMultiProgressBar extends SummaryMultiProgressBar {
    printType = "log";
    updateIntervalMs = parseInt(process.env.IPULL_CI_UPDATE_INTERVAL ?? "0") || 8_000;
}
//# sourceMappingURL=CIMultiProgressBar.js.map