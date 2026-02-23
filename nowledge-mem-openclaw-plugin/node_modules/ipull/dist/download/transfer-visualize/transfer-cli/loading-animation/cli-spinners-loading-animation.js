import BaseLoadingAnimation, { DEFAULT_LOADING_ANIMATION_OPTIONS } from "./base-loading-animation.js";
export default class CliSpinnersLoadingAnimation extends BaseLoadingAnimation {
    _spinner;
    _frameIndex = 0;
    constructor(spinner, options) {
        options = { ...DEFAULT_LOADING_ANIMATION_OPTIONS, ...options };
        options.updateIntervalMs ??= spinner.interval;
        super(options);
        this._spinner = spinner;
    }
    createFrame() {
        const frame = this._spinner.frames[this._frameIndex];
        this._frameIndex++;
        if (this._frameIndex >= this._spinner.frames.length) {
            this._frameIndex = 0;
        }
        return `${frame} ${this.options.loadingText}`;
    }
}
//# sourceMappingURL=cli-spinners-loading-animation.js.map