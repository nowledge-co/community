import BaseTransferCliProgressBar from "./base-transfer-cli-progress-bar.js";
/**
 * A class to display transfer progress in the terminal, with a progress bar and other information.
 */
export default class FancyTransferCliProgressBar extends BaseTransferCliProgressBar {
    protected renderProgressLine(): string;
    protected renderFinishedLine(): string;
    protected renderPendingLine(): string;
}
