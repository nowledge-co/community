import BaseTransferCliProgressBar, { BaseCliOptions } from "./base-transfer-cli-progress-bar.js";
export type AvailableCLIProgressStyle = "basic" | "fancy" | "ci" | "summary" | "auto";
export default function switchCliProgressStyle(cliStyle: AvailableCLIProgressStyle, options: BaseCliOptions): BaseTransferCliProgressBar;
