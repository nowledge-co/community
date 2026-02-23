import DownloadEngineNodejs from "../../download-engine/engine/download-engine-nodejs.js";
import DownloadEngineMultiDownload from "../../download-engine/engine/download-engine-multi-download.js";
import { AvailableCLIProgressStyle } from "./progress-bars/switch-cli-progress-style.js";
import { CliFormattedStatus } from "./progress-bars/base-transfer-cli-progress-bar.js";
import { BaseMultiProgressBar } from "./multiProgressBars/BaseMultiProgressBar.js";
import cliSpinners from "cli-spinners";
type AllowedDownloadEngines = DownloadEngineNodejs | DownloadEngineMultiDownload;
export type CliProgressDownloadEngineOptions = {
    truncateName?: boolean | number;
    cliProgress?: boolean;
    maxViewDownloads?: number;
    createMultiProgressBar?: typeof BaseMultiProgressBar;
    cliStyle?: AvailableCLIProgressStyle | ((status: CliFormattedStatus) => string);
    cliName?: string;
    cliAction?: string;
    fetchStrategy?: "localFile" | "fetch";
    loadingAnimation?: cliSpinners.SpinnerName;
};
export default class CliAnimationWrapper {
    private readonly _downloadEngine;
    private readonly _options;
    private _activeCLI?;
    constructor(downloadEngine: Promise<AllowedDownloadEngines>, _options: CliProgressDownloadEngineOptions);
    private _init;
    attachAnimation(): Promise<void>;
}
export {};
