import BaseTransferCliProgressBar from "./base-transfer-cli-progress-bar.js";
import FancyTransferCliProgressBar from "./fancy-transfer-cli-progress-bar.js";
import SummaryTransferCliProgressBar from "./summary-transfer-cli-progress-bar.js";
import ci from "ci-info";
import CiTransferCliProgressBar from "./ci-transfer-cli-progress-bar.js";
export default function switchCliProgressStyle(cliStyle, options) {
    switch (cliStyle) {
        case "basic":
            return new BaseTransferCliProgressBar(options);
        case "fancy":
            return new FancyTransferCliProgressBar(options);
        case "summary":
            return new SummaryTransferCliProgressBar(options);
        case "ci":
            return new CiTransferCliProgressBar(options);
        case "auto":
            if (ci.isCI || process.env.IPULL_USE_CI_STYLE) {
                return switchCliProgressStyle("ci", options);
            }
            else {
                return switchCliProgressStyle("fancy", options);
            }
    }
    void cliStyle;
    throw new Error(`Unknown CLI progress style: ${cliStyle}`);
}
//# sourceMappingURL=switch-cli-progress-style.js.map