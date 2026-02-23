import UpdateManager from "stdout-update";
import { CLIProgressPrintType } from "../multiProgressBars/BaseMultiProgressBar.js";
export type BaseLoadingAnimationOptions = {
    updateIntervalMs?: number | null;
    loadingText?: string;
    logType: CLIProgressPrintType;
};
export declare const DEFAULT_LOADING_ANIMATION_OPTIONS: BaseLoadingAnimationOptions;
export default abstract class BaseLoadingAnimation {
    protected options: BaseLoadingAnimationOptions;
    protected stdoutManager: UpdateManager;
    protected _animationActive: boolean;
    protected constructor(options?: BaseLoadingAnimationOptions);
    protected _render(): void;
    protected abstract createFrame(): string;
    start(): Promise<void>;
    stop(): void;
    private _processExit;
}
