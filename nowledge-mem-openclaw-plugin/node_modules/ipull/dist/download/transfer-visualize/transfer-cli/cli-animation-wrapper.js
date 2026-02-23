import switchCliProgressStyle from "./progress-bars/switch-cli-progress-style.js";
import TransferCli from "./transfer-cli.js";
import { BaseMultiProgressBar } from "./multiProgressBars/BaseMultiProgressBar.js";
const DEFAULT_CLI_STYLE = "auto";
export default class CliAnimationWrapper {
    _downloadEngine;
    _options;
    _activeCLI;
    constructor(downloadEngine, _options) {
        this._options = _options;
        this._downloadEngine = downloadEngine;
        this._init();
    }
    _init() {
        if (!this._options.cliProgress) {
            return;
        }
        this._options.cliAction ??= this._options.fetchStrategy === "localFile" ? "Copying" : "Downloading";
        const cliOptions = { ...this._options };
        if (this._options.cliAction) {
            cliOptions.action = this._options.cliAction;
        }
        if (this._options.cliName) {
            cliOptions.name = this._options.cliName;
        }
        cliOptions.createProgressBar = typeof this._options.cliStyle === "function" ?
            {
                createStatusLine: this._options.cliStyle,
                multiProgressBar: this._options.createMultiProgressBar ?? BaseMultiProgressBar
            } :
            switchCliProgressStyle(this._options.cliStyle ?? DEFAULT_CLI_STYLE, {
                truncateName: this._options.truncateName,
                loadingSpinner: this._options.loadingAnimation
            });
        this._activeCLI = new TransferCli(cliOptions, this._options.cliLevel);
    }
    async attachAnimation() {
        if (!this._activeCLI) {
            return;
        }
        this._activeCLI.loadingAnimation.start();
        try {
            const engine = await this._downloadEngine;
            this._activeCLI.loadingAnimation.stop();
            engine.once("start", () => {
                this._activeCLI?.start();
                engine.on("progress", (progress) => {
                    this._activeCLI?.updateStatues(engine.downloadStatues, progress);
                });
                engine.on("closed", () => {
                    this._activeCLI?.stop();
                });
            });
        }
        finally {
            this._activeCLI.loadingAnimation.stop();
        }
    }
}
//# sourceMappingURL=cli-animation-wrapper.js.map