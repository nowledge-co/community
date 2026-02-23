import ora from "ora";
import { useCiLogs } from "../config.js";
import { getConsoleLogPrefix } from "./getConsoleLogPrefix.js";
import withStatusLogs from "./withStatusLogs.js";
export default async function withOra(message, callback) {
    if (useCiLogs || (typeof message !== "string" && message.useStatusLogs))
        return withStatusLogs(message, callback);
    const spinner = ora({
        prefixText: getConsoleLogPrefix(),
        ...(typeof message === "string"
            ? { text: message }
            : { loading: message.loading, success: message.success, fail: message.fail })
    });
    spinner.start(typeof message === "string"
        ? message
        : message.loading);
    try {
        const res = await callback();
        if (typeof message !== "string") {
            if (message.noSuccessLiveStatus)
                spinner.stop();
            else
                spinner.succeed(message.success);
        }
        else
            spinner.succeed(message);
        return res;
    }
    catch (er) {
        if (typeof message !== "string")
            spinner.fail(message.fail);
        else
            spinner.fail(message);
        throw er;
    }
}
//# sourceMappingURL=withOra.js.map