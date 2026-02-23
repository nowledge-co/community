import UpdateManager from "stdout-update";
import { TransferCliProgressBar } from "./progress-bars/base-transfer-cli-progress-bar.js";
import cliSpinners from "cli-spinners";
import CliSpinnersLoadingAnimation from "./loading-animation/cli-spinners-loading-animation.js";
import { FormattedStatus } from "../format-transfer-status.js";
import { BaseMultiProgressBar } from "./multiProgressBars/BaseMultiProgressBar.js";
export type TransferCliOptions = {
    action?: string;
    name?: string;
    maxViewDownloads: number;
    truncateName: boolean | number;
    debounceWait: number;
    maxDebounceWait: number;
    createProgressBar: TransferCliProgressBar;
    createMultiProgressBar: typeof BaseMultiProgressBar;
    loadingAnimation: cliSpinners.SpinnerName;
    loadingText?: string;
};
export declare const DEFAULT_TRANSFER_CLI_OPTIONS: TransferCliOptions;
export declare enum CLI_LEVEL {
    LOW = 0,
    HIGH = 2
}
export default class TransferCli {
    static activeCLILevel: CLI_LEVEL;
    readonly loadingAnimation: CliSpinnersLoadingAnimation;
    protected options: TransferCliOptions;
    protected stdoutManager: UpdateManager;
    protected myCLILevel: number;
    protected latestProgress: [FormattedStatus[], FormattedStatus];
    private _cliStopped;
    private readonly _updateStatuesDebounce;
    private _multiProgressBar;
    private _isFirstPrint;
    constructor(options: Partial<TransferCliOptions>, myCLILevel?: CLI_LEVEL);
    start(): void;
    stop(): void;
    private _processExit;
    updateStatues(statues: FormattedStatus[], oneStatus: FormattedStatus): void;
    private _updateStatues;
    protected _logUpdate(text: string): void;
}
