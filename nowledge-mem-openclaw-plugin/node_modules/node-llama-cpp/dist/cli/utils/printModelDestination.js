import chalk from "chalk";
import { getReadablePath } from "./getReadablePath.js";
export function printModelDestination(modelDestination) {
    if (modelDestination.type === "url")
        console.info(`${chalk.yellow("URL:")} ${modelDestination.url}`);
    else if (modelDestination.type === "uri")
        console.info(`${chalk.yellow("URI:")} ${modelDestination.uri}`);
    else
        console.info(`${chalk.yellow("File:")} ${getReadablePath(modelDestination.path)}`);
}
//# sourceMappingURL=printModelDestination.js.map