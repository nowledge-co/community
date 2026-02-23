import UpdateManager from "stdout-update";
import sleep from "sleep-promise";
export const DEFAULT_LOADING_ANIMATION_OPTIONS = {
    loadingText: "Gathering information",
    logType: "update"
};
const DEFAULT_UPDATE_INTERVAL_MS = 300;
export default class BaseLoadingAnimation {
    options;
    stdoutManager = UpdateManager.getInstance();
    _animationActive = false;
    constructor(options = DEFAULT_LOADING_ANIMATION_OPTIONS) {
        this.options = options;
        this._processExit = this._processExit.bind(this);
    }
    _render() {
        const frame = this.createFrame();
        if (this.options.logType === "update") {
            this.stdoutManager.update([frame]);
        }
        else {
            console.log(frame);
        }
    }
    async start() {
        process.on("SIGINT", this._processExit);
        if (this.options.logType === "update") {
            this.stdoutManager.hook();
        }
        this._animationActive = true;
        while (this._animationActive) {
            this._render();
            await sleep(this.options.updateIntervalMs || DEFAULT_UPDATE_INTERVAL_MS);
        }
    }
    stop() {
        if (!this._animationActive) {
            return;
        }
        this._animationActive = false;
        if (this.options.logType === "update") {
            this.stdoutManager.erase();
            this.stdoutManager.unhook(false);
        }
        process.off("SIGINT", this._processExit);
    }
    _processExit() {
        this.stop();
        process.exit(0);
    }
}
//# sourceMappingURL=base-loading-animation.js.map