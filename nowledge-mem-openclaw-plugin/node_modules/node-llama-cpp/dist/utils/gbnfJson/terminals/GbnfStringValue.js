import { GbnfTerminal } from "../GbnfTerminal.js";
export class GbnfStringValue extends GbnfTerminal {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    getGrammar() {
        return [
            '"',
            '\\"',
            this.value
                .replaceAll("\\", "\\\\\\\\")
                .replaceAll("\t", "\\\\t")
                .replaceAll("\r", "\\\\r")
                .replaceAll("\n", "\\\\n")
                .replaceAll('"', "\\\\" + '\\"'),
            '\\"',
            '"'
        ].join("");
    }
    generateRuleName(grammarGenerator) {
        return grammarGenerator.generateRuleNameForLiteralValue(this.value);
    }
}
//# sourceMappingURL=GbnfStringValue.js.map