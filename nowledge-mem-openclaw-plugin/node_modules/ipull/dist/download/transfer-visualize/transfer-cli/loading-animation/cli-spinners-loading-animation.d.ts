import BaseLoadingAnimation, { BaseLoadingAnimationOptions } from "./base-loading-animation.js";
import { Spinner } from "cli-spinners";
export default class CliSpinnersLoadingAnimation extends BaseLoadingAnimation {
    private _spinner;
    private _frameIndex;
    constructor(spinner: Spinner, options: BaseLoadingAnimationOptions);
    protected createFrame(): string;
}
