export declare function withProgressLog<T>({ loadingText, successText, failText, liveUpdates, statusIcons, initialPercentage, initialProgressBarText, progressBarLength, minPercentageChangeForNonLiveUpdates, eta, etaUpdateInterval, noProgress, progressFractionDigits, noSuccessLiveStatus, liveCtrlCSendsAbortSignal }: {
    loadingText: string;
    successText: string;
    failText: string;
    liveUpdates?: boolean;
    statusIcons?: boolean;
    initialPercentage?: number;
    initialProgressBarText?: string;
    progressBarLength?: number;
    minPercentageChangeForNonLiveUpdates?: number;
    eta?: boolean;
    etaUpdateInterval?: number;
    noProgress?: boolean;
    progressFractionDigits?: boolean;
    noSuccessLiveStatus?: boolean;
    liveCtrlCSendsAbortSignal?: boolean;
}, callback: (progressUpdater: ProgressUpdater) => Promise<T>): Promise<T>;
type ProgressUpdater = {
    setProgress(percentage: number, progressText?: string): ProgressUpdater;
    abortSignal?: AbortSignal;
};
export {};
