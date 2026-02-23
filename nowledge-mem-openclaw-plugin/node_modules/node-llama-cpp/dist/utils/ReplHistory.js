import path from "path";
import fs from "fs-extra";
import { withLock } from "lifecycle-utils";
const emptyHistory = {
    history: []
};
export class ReplHistory {
    _filePath;
    _fileContent;
    constructor(filePath, fileContent) {
        this._filePath = filePath;
        this._fileContent = fileContent;
    }
    async add(line) {
        if (this._filePath == null) {
            this._fileContent = this._addItemToHistory(line, this._fileContent);
            return;
        }
        await withLock([this, "file"], async () => {
            try {
                const json = parseReplJsonfile(await fs.readJSON(this._filePath));
                this._fileContent = this._addItemToHistory(line, json);
                await fs.ensureDir(path.dirname(this._filePath));
                await fs.writeJSON(this._filePath, this._fileContent, {
                    spaces: 4
                });
            }
            catch (err) { }
        });
    }
    get history() {
        return this._fileContent.history;
    }
    _addItemToHistory(item, fileContent) {
        const newHistory = fileContent.history.slice();
        const currentItemIndex = newHistory.indexOf(item);
        if (currentItemIndex !== -1)
            newHistory.splice(currentItemIndex, 1);
        newHistory.unshift(item);
        return {
            ...fileContent,
            history: newHistory
        };
    }
    static async load(filePath, saveAndLoadHistory = true) {
        if (!saveAndLoadHistory)
            return new ReplHistory(null, {
                history: []
            });
        try {
            if (!(await fs.pathExists(filePath))) {
                await fs.ensureDir(path.dirname(filePath));
                await fs.writeJSON(filePath, emptyHistory, {
                    spaces: 4
                });
            }
            const json = parseReplJsonfile(await fs.readJSON(filePath));
            return new ReplHistory(filePath, json);
        }
        catch (err) {
            return new ReplHistory(null, {
                history: []
            });
        }
    }
}
function parseReplJsonfile(file) {
    if (typeof file !== "object" || file == null || !("history" in file) || !(file.history instanceof Array) || file.history.some((item) => typeof item !== "string"))
        throw new Error("Invalid ReplyHistory file");
    return file;
}
//# sourceMappingURL=ReplHistory.js.map