import { TransferProgressInfo } from "./transfer-statistics.js";
import { Options as PrettyMsOptions } from "pretty-ms";
import { ProgressStatus } from "../download-engine/download-file/progress-status-file.js";
export type CliInfoStatus = TransferProgressInfo & {
    fileName?: string;
    comment?: string;
};
export type FormattedStatus = ProgressStatus & CliInfoStatus & {
    formattedSpeed: string;
    formatTransferred: string;
    formatTotal: string;
    formatTransferredOfTotal: string;
    formatTimeLeft: string;
    formattedPercentage: string;
    formattedComment: string;
};
export declare const PRETTY_MS_OPTIONS: PrettyMsOptions;
export declare function createFormattedStatus(status: ProgressStatus | FormattedStatus): FormattedStatus;
