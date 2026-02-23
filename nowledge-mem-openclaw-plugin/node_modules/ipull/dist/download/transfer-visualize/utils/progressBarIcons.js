import isUnicodeSupported from "is-unicode-supported";
import chalk from "chalk";
export const STATUS_ICONS = isUnicodeSupported()
    ? {
        activeDownload: chalk.blue("⏵"),
        done: chalk.green("✔"),
        failed: chalk.red("✖"),
        pending: chalk.yellow("\u25f7")
    }
    : {
        activeDownload: chalk.blue.bold(">"),
        done: chalk.green("√"),
        failed: chalk.red("×"),
        pending: chalk.yellow.bold("-")
    };
//# sourceMappingURL=progressBarIcons.js.map