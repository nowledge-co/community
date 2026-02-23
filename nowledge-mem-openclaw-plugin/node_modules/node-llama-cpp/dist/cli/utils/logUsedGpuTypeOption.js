import chalk from "chalk";
import { getPrettyBuildGpuName } from "../../bindings/consts.js";
export function logUsedGpuTypeOption(gpu) {
    if (gpu == false)
        console.log(`${chalk.yellow("GPU:")} disabled`);
    else
        console.log(`${chalk.yellow("GPU:")} ${getPrettyBuildGpuName(gpu)}`);
}
//# sourceMappingURL=logUsedGpuTypeOption.js.map