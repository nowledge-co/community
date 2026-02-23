import chalk from "chalk";
import sliceAnsi from "slice-ansi";
import stripAnsi from "strip-ansi";
export class ConsoleTable {
    _columns;
    _columnSeparator;
    _drawHeaderRowSeparator;
    constructor(columns, { columnSeparator = chalk.gray(" | "), drawHeaderRowSeparator = true } = {}) {
        this._columns = filterHiddenColumns(columns);
        this._columnSeparator = columnSeparator;
        this._drawHeaderRowSeparator = drawHeaderRowSeparator;
    }
    logHeader({ drawRowSeparator = this._drawHeaderRowSeparator } = {}) {
        let logLine = "";
        for (let i = 0; i < this._columns.length; i++) {
            const column = this._columns[i];
            const canSpanOverEmptyColumns = column.canSpanOverEmptyColumns ?? false;
            let title = column.title ?? " ";
            let columnSize = getColumnWidth(column);
            title = toOneLine(title);
            title = (column.titleFormatter ?? defaultTitleFormatter)(title);
            while (title.length > columnSize && canSpanOverEmptyColumns && i < this._columns.length - 1) {
                i++;
                const nextColumn = this._columns[i];
                if (nextColumn.title != null) {
                    i--;
                    break;
                }
                columnSize += stripAnsi(this._columnSeparator).length + getColumnWidth(nextColumn);
            }
            const moreText = "...";
            if (stripAnsi(title).length > columnSize)
                title = sliceAnsi(title, 0, columnSize - moreText.length) + chalk.gray(moreText);
            title = title + " ".repeat(Math.max(0, columnSize - stripAnsi(title).length));
            title = sliceAnsi(title, 0, columnSize);
            if (i < this._columns.length - 1)
                title += this._columnSeparator;
            logLine += title;
        }
        console.info(logLine);
        if (drawRowSeparator)
            console.info(chalk.gray("-".repeat(stripAnsi(logLine).length)));
    }
    logLine(data) {
        let logLine = "";
        for (let i = 0; i < this._columns.length; i++) {
            const column = this._columns[i];
            let value = data[column.key];
            const canSpanOverEmptyColumns = column.canSpanOverEmptyColumns ?? false;
            if (value != null && column.valueFormatter != null)
                value = column.valueFormatter(value);
            if (value == null)
                value = "";
            value = toOneLine(value);
            const valueWithoutAnsi = stripAnsi(value);
            let columnSize = getColumnWidth(column);
            while (valueWithoutAnsi.length > columnSize && canSpanOverEmptyColumns && i < this._columns.length - 1) {
                i++;
                const nextColumn = this._columns[i];
                const nextValue = data[nextColumn.key];
                if (nextValue != null) {
                    i--;
                    break;
                }
                columnSize += stripAnsi(this._columnSeparator).length + getColumnWidth(nextColumn);
            }
            const moreText = "...";
            if (valueWithoutAnsi.length > columnSize)
                value = sliceAnsi(value, 0, columnSize - moreText.length) + chalk.gray(moreText);
            value = value + " ".repeat(Math.max(0, columnSize - valueWithoutAnsi.length));
            value = sliceAnsi(value, 0, columnSize);
            if (i < this._columns.length - 1)
                value += this._columnSeparator;
            logLine += value;
        }
        console.info(logLine);
    }
}
const defaultTitleFormatter = (value) => chalk.bold(value);
function getColumnWidth(column) {
    return column.width ?? stripAnsi(toOneLine(column.title ?? " ")).length;
}
function toOneLine(text) {
    return text.replaceAll("\n", chalk.gray("\\n"));
}
function filterHiddenColumns(columns) {
    return columns
        .filter((column) => column.visible !== false);
}
//# sourceMappingURL=ConsoleTable.js.map