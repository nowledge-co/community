export type TransferProgressInfo = {
    transferredBytes: number;
    totalBytes: number;
    speed: number;
    percentage: number;
    timeLeft: number;
    ended: boolean;
};
/**
 * Class to calculate transfer statistics, such as speed, percentage, time left, etc.
 * @example
 * You need to call `updateProgress` on every progress update to get the latest statistics.
 * ```ts
 * const statistics = new TransferStatistics();
 * const progress = statistics.updateProgress(100, 1000); // { speed: 100, percentage: 10, timeLeft: 900 ...}
 * console.log(progress);
 * ```
 */
export default class TransferStatistics {
    protected static readonly _AVERAGE_SPEED_LAST_SECONDS = 10;
    private _speeds;
    private _lastTransferred;
    private _latestProgress?;
    get latestProgress(): TransferProgressInfo | undefined;
    private _calculateSpeed;
    updateProgress(transferred: number, total: number): TransferProgressInfo;
    static oneStatistics(transferred: number, total: number): TransferProgressInfo;
}
