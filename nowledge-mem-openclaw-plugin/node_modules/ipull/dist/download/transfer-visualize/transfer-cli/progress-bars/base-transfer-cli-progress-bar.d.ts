import { FormattedStatus } from "../../format-transfer-status.js";
import { BaseMultiProgressBar } from "../multiProgressBars/BaseMultiProgressBar.js";
import { DataLine, DataPart } from "../../utils/data-line.js";
import cliSpinners, { Spinner } from "cli-spinners";
export type CliFormattedStatus = FormattedStatus & {
    transferAction: string;
};
export type BaseCliOptions = {
    truncateName?: boolean | number;
    loadingSpinner?: cliSpinners.SpinnerName;
};
export interface TransferCliProgressBar {
    multiProgressBar: typeof BaseMultiProgressBar;
    createStatusLine(status: CliFormattedStatus): string;
}
/**
 * A class to display transfer progress in the terminal, with a progress bar and other information.
 */
export default class BaseTransferCliProgressBar implements TransferCliProgressBar {
    multiProgressBar: typeof BaseMultiProgressBar;
    downloadLoadingSpinner: Spinner;
    private _spinnerState;
    protected status: CliFormattedStatus;
    protected options: BaseCliOptions;
    protected minNameLength: number;
    constructor(options: BaseCliOptions);
    switchTransferToShortText(): string;
    protected get showETA(): boolean;
    protected getNameSize(fileName?: string): number;
    protected getSpinnerText(): string;
    protected getNameAndCommentDataParts(): DataPart[];
    protected getETA(spacer?: string, formatter?: (text: string, size: number, type: "spacer" | "time") => string): DataLine;
    protected createProgressBarLine(length: number): string;
    protected renderProgressLine(): string;
    protected renderFinishedLine(): string;
    protected renderPendingLine(): string;
    protected renderLoadingLine(): string;
    createStatusLine(status: CliFormattedStatus): string;
}
