import { GbnfTerminal } from "../GbnfTerminal.js";
export class GbnfVerbatimText extends GbnfTerminal {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    getGrammar() {
        return [
            '"',
            this.value
                .replaceAll("\\", "\\\\")
                .replaceAll('"', '\\"')
                .replaceAll("\t", "\\t")
                .replaceAll("\r", "\\r")
                .replaceAll("\n", "\\n"),
            '"'
        ].join("");
    }
}
//# sourceMappingURL=GbnfVerbatimText.js.map