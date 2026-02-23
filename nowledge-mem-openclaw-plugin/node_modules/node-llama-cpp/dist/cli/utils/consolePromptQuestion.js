import readline from "readline";
import process from "process";
import chalk from "chalk";
import { splitAnsiToLines } from "./splitAnsiToLines.js";
export async function consolePromptQuestion(question, { validate, renderSummaryOnExit, exitOnCtrlC = true, defaultValue } = {}) {
    let lastErrorText = "";
    let lastResponse = "";
    process.stdout.moveCursor(0, -1);
    while (true) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        let res = await new Promise((accept) => {
            const initialCursorPosition = rl.getCursorPos();
            function onSigInt() {
                rl.off("SIGINT", onSigInt);
                rl.close();
                const linesUsed = splitAnsiToLines(lastErrorText, process.stdout.columns).length +
                    rl.getCursorPos().rows - initialCursorPosition.rows + 1;
                clearLastLines(linesUsed);
                if (exitOnCtrlC) {
                    rl.close();
                    process.exit(0);
                }
                else
                    accept(null);
            }
            rl.on("SIGINT", onSigInt);
            rl.question(question, (res) => {
                rl.off("SIGINT", onSigInt);
                rl.close();
                accept(res);
            });
            rl.write(lastResponse);
        });
        const linesUsed = splitAnsiToLines(lastErrorText + question + res, process.stdout.columns).length + (res != null ? 1 : 0);
        if (res == null) {
            clearLastLines(linesUsed);
            if (renderSummaryOnExit != null) {
                const summary = renderSummaryOnExit(null);
                if (summary !== "")
                    process.stdout.write(summary + "\n");
            }
            return null;
        }
        if (res === "" && defaultValue != null)
            res = defaultValue;
        lastResponse = res;
        const validationError = await validate?.(res);
        if (validationError != null) {
            clearLastLines(linesUsed);
            lastErrorText = chalk.red(validationError) + "\n";
            process.stdout.write(lastErrorText);
            continue;
        }
        else if (renderSummaryOnExit != null) {
            clearLastLines(linesUsed);
            const summary = renderSummaryOnExit(res);
            if (summary !== "")
                process.stdout.write(summary + "\n");
        }
        else if (lastErrorText !== "") {
            clearLastLines(linesUsed);
            process.stdout.write(question + res + "\n");
        }
        return res;
    }
}
function clearLastLines(linesCount) {
    if (linesCount === 0)
        return;
    process.stdout.write("\n");
    for (let i = 0; i < linesCount; i++) {
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(0);
    }
    process.stdout.write("\n");
    process.stdout.moveCursor(0, -1);
}
//# sourceMappingURL=consolePromptQuestion.js.map