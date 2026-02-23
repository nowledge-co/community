import { BaseMultiProgressBar, CLIProgressPrintType } from "./BaseMultiProgressBar.js";
import { FormattedStatus } from "../../format-transfer-status.js";
export declare class SummaryMultiProgressBar extends BaseMultiProgressBar {
    readonly printType: CLIProgressPrintType;
    readonly updateIntervalMs: number;
    private _parallelDownloads;
    private _lastStatuses;
    createMultiProgressBar(statuses: FormattedStatus[], oneStatus: FormattedStatus): string;
}
