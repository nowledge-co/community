import UpdateManager from "stdout-update";
import debounce from "lodash.debounce";
import cliSpinners from "cli-spinners";
import CliSpinnersLoadingAnimation from "./loading-animation/cli-spinners-loading-animation.js";
import switchCliProgressStyle from "./progress-bars/switch-cli-progress-style.js";
import { BaseMultiProgressBar } from "./multiProgressBars/BaseMultiProgressBar.js";
export const DEFAULT_TRANSFER_CLI_OPTIONS = {
    maxViewDownloads: 10,
    truncateName: true,
    debounceWait: 20,
    maxDebounceWait: process.platform === "win32" ? 500 : 100,
    createProgressBar: switchCliProgressStyle("auto", { truncateName: true }),
    loadingAnimation: "dots",
    loadingText: "Gathering information",
    createMultiProgressBar: BaseMultiProgressBar
};
export var CLI_LEVEL;
(function (CLI_LEVEL) {
    CLI_LEVEL[CLI_LEVEL["LOW"] = 0] = "LOW";
    CLI_LEVEL[CLI_LEVEL["HIGH"] = 2] = "HIGH";
})(CLI_LEVEL || (CLI_LEVEL = {}));
export default class TransferCli {
    static activeCLILevel = CLI_LEVEL.LOW;
    loadingAnimation;
    options;
    stdoutManager = UpdateManager.getInstance();
    myCLILevel;
    latestProgress = null;
    _cliStopped = true;
    _updateStatuesDebounce;
    _multiProgressBar;
    _isFirstPrint = true;
    constructor(options, myCLILevel = CLI_LEVEL.LOW) {
        TransferCli.activeCLILevel = this.myCLILevel = myCLILevel;
        this.options = { ...DEFAULT_TRANSFER_CLI_OPTIONS, ...options };
        this._multiProgressBar = new this.options.createProgressBar.multiProgressBar(this.options);
        const maxDebounceWait = this._multiProgressBar.updateIntervalMs || this.options.maxDebounceWait;
        this._updateStatuesDebounce = debounce(this._updateStatues.bind(this), maxDebounceWait, {
            maxWait: maxDebounceWait
        });
        this.loadingAnimation = new CliSpinnersLoadingAnimation(cliSpinners[this.options.loadingAnimation], {
            loadingText: this.options.loadingText,
            updateIntervalMs: this._multiProgressBar.updateIntervalMs,
            logType: this._multiProgressBar.printType
        });
        this._processExit = this._processExit.bind(this);
    }
    start() {
        if (this.myCLILevel !== TransferCli.activeCLILevel)
            return;
        this._cliStopped = false;
        if (this._multiProgressBar.printType === "update") {
            this.stdoutManager.hook();
        }
        process.on("SIGINT", this._processExit);
    }
    stop() {
        if (this._cliStopped || this.myCLILevel !== TransferCli.activeCLILevel)
            return;
        this._updateStatues();
        this._cliStopped = true;
        if (this._multiProgressBar.printType === "update") {
            this.stdoutManager.unhook(false);
        }
        process.off("SIGINT", this._processExit);
    }
    _processExit() {
        this.stop();
        process.exit(0);
    }
    updateStatues(statues, oneStatus) {
        this.latestProgress = [statues, oneStatus];
        if (this._isFirstPrint) {
            this._isFirstPrint = false;
            this._updateStatues();
        }
        else {
            this._updateStatuesDebounce();
        }
    }
    _updateStatues() {
        if (this._cliStopped || this.myCLILevel !== TransferCli.activeCLILevel) {
            return; // Do not update if there is a higher level CLI, meaning that this CLI is sub-CLI
        }
        const printLog = this._multiProgressBar.createMultiProgressBar(...this.latestProgress);
        if (printLog) {
            this._logUpdate(printLog);
        }
    }
    _logUpdate(text) {
        if (this._multiProgressBar.printType === "update") {
            this.stdoutManager.update(text.split("\n"));
        }
        else {
            console.log(text);
        }
    }
}
//# sourceMappingURL=transfer-cli.js.map