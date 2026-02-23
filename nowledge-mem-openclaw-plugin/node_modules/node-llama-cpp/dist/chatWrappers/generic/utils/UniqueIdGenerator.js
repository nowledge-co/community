export class UniqueIdGenerator {
    antiText;
    _ids = new Set();
    constructor(antiText) {
        this.antiText = antiText;
    }
    generateId(numbersOnly = false) {
        let id;
        do {
            if (numbersOnly) {
                do {
                    id = (Math.random()
                        .toString(10)
                        .slice(2)
                        .slice(0, String(Number.MAX_SAFE_INTEGER).length - 1));
                } while (id.startsWith("0"));
            }
            else
                id = "W" + (Math.random()
                    .toString(36)
                    .slice(2)) + "W";
        } while (this._ids.has(id) || this.antiText.includes(id));
        this._ids.add(id);
        return id;
    }
    removeId(id) {
        this._ids.delete(id);
    }
}
//# sourceMappingURL=UniqueIdGenerator.js.map