import chalk from "chalk";
import stripAnsi from "strip-ansi";
export function printInfoLine(options) {
    console.info(renderInfoLine(options));
}
export function renderInfoLine({ title, padTitle = 0, separateLines = false, info, maxWidth = process.stdout.columns - 1 }) {
    const res = [];
    const items = [];
    if (separateLines) {
        if (title != null && title.length > 0)
            res.push(chalk.yellowBright(`${title.trim()}`));
        for (const { title, value, show } of info) {
            if (show === false)
                continue;
            if (title == null || title === "")
                items.push(value instanceof Function ? value() : value);
            else
                items.push(`${chalk.yellow(title + ":")} ${value instanceof Function ? value() : value}`);
        }
        const itemPrefix = `${chalk.dim("|")} `;
        res.push(itemPrefix + items.join("\n" + itemPrefix));
        return res.join("\n") + "\n";
    }
    else {
        if (title != null && title.length > 0)
            res.push(chalk.yellowBright(`${title.padEnd(padTitle, " ")}`));
        for (const { title, value, show } of info) {
            if (show === false)
                continue;
            if (title == null || title === "")
                items.push(chalk.bgGray(` ${value instanceof Function ? value() : value} `));
            else
                items.push(chalk.bgGray(` ${chalk.yellow(title + ":")} ${value instanceof Function ? value() : value} `));
        }
        const startPad = stripAnsi(res.join(" ")).length + (res.length > 0 ? " ".length : 0);
        res.push(splitItemsIntoLines(items, maxWidth - startPad).join("\n" + " ".repeat(startPad)));
        return res.join(" ");
    }
}
function splitItemsIntoLines(items, maxLineLength) {
    const lines = [];
    let currentLine = [];
    for (const item of items) {
        if (stripAnsi([...currentLine, item].join(" ")).length > maxLineLength) {
            lines.push(currentLine.join(" "));
            currentLine = [];
        }
        currentLine.push(item);
    }
    if (currentLine.length > 0)
        lines.push(currentLine.join(" "));
    return lines;
}
//# sourceMappingURL=printInfoLine.js.map