import chalk from "chalk";
import { getForceShowConsoleLogPrefix, getIsRunningFromCLI } from "../state.js";
export function getConsoleLogPrefix(forcePrefix = false, padEnd = true) {
    const isInCLI = getIsRunningFromCLI();
    const forceShowLogPrefix = getForceShowConsoleLogPrefix();
    if (!isInCLI || forceShowLogPrefix || forcePrefix)
        return chalk.gray("[node-llama-cpp]") + (padEnd ? " " : "");
    return "";
}
//# sourceMappingURL=getConsoleLogPrefix.js.map