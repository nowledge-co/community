import chalk from "chalk";
import stripAnsi from "strip-ansi";
export function prettyPrintObject(obj, indent = 4, options = {}) {
    if (typeof obj === "string")
        return chalk.green(JSON.stringify(obj, null, 4));
    else if (typeof obj === "number" || typeof obj === "bigint")
        return chalk.yellow(formatNumber(obj, { useNumberGrouping: options.useNumberGrouping }));
    else if (typeof obj === "boolean")
        return chalk.magenta.italic(obj);
    else if (obj === null)
        return chalk.magenta.italic("null");
    else if (obj === undefined)
        return chalk.magenta.italic("undefined");
    else if (obj instanceof Array)
        return prettyPrintArray(obj, indent, options);
    const nl = options.multilineObjects ?? true;
    const rows = [];
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        rows.push([
            (nl ? " ".repeat(indent) : ""),
            canStringBeKeyWithoutQuotes(key)
                ? chalk.red(key)
                : chalk.green(JSON.stringify(key)),
            chalk.whiteBright(": "),
            prettyPrintObject(value, indent, options)
                .replaceAll("\n", "\n" + (nl ? " ".repeat(indent) : ""))
        ].join(""));
    }
    if (rows.length === 0)
        return chalk.whiteBright("{}");
    return [
        chalk.whiteBright("{" + (nl ? "\n" : "")),
        rows.join(chalk.whiteBright("," + (nl ? "\n" : " "))),
        (nl ? "\n" : ""),
        chalk.whiteBright("}")
    ].join("");
}
function canStringBeKeyWithoutQuotes(key) {
    return JSON.stringify(key).slice(1, -1) === key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key);
}
function prettyPrintArray(arr, indent = 4, options = {}) {
    const slicedArray = (options.maxArrayValues != null && arr.length > options.maxArrayValues)
        ? arr.slice(0, options.maxArrayValues)
        : arr;
    const hiddenItems = arr.length - slicedArray.length;
    const arrayItems = slicedArray.map((item) => prettyPrintObject(item, indent, options))
        .concat(hiddenItems > 0
        ? [chalk.white("..." + hiddenItems + " more item" + (hiddenItems !== 1 ? "s" : ""))]
        : []);
    const oneLineJoinedArrayItems = arrayItems.join(chalk.whiteBright(", "));
    if (options.maxArrayItemsWidth != null &&
        ("[".length + stripAnsi(oneLineJoinedArrayItems).length + "]".length) > options.maxArrayItemsWidth) {
        return [
            chalk.whiteBright("["),
            "\n",
            " ".repeat(indent),
            arrayItems
                .join(chalk.whiteBright(",") + "\n")
                .replaceAll("\n", "\n" + " ".repeat(indent)),
            "\n",
            chalk.whiteBright("]")
        ].join("");
    }
    return [
        chalk.whiteBright("["),
        oneLineJoinedArrayItems,
        chalk.whiteBright("]")
    ].join("");
}
export function formatNumber(num, { useNumberGrouping = false } = {}) {
    let res = useNumberGrouping
        ? num
            .toLocaleString("en-US", {
            style: "decimal",
            useGrouping: true
        })
            .replaceAll(",", "_")
        : String(num);
    if (typeof num === "bigint")
        res += "n";
    return res;
}
//# sourceMappingURL=prettyPrintObject.js.map