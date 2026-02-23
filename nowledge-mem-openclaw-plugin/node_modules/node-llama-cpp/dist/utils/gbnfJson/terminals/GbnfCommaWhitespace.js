import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammar } from "./GbnfGrammar.js";
import { GbnfWhitespace } from "./GbnfWhitespace.js";
import { reservedRuleNames } from "./gbnfConsts.js";
export class GbnfCommaWhitespace extends GbnfTerminal {
    scopeState;
    newLine;
    constructor(scopeState, { newLine = "before" } = {}) {
        super();
        this.scopeState = scopeState;
        this.newLine = newLine;
    }
    getGrammar() {
        return new GbnfGrammar([
            '","', new GbnfWhitespace(this.scopeState, { newLine: this.newLine }).getGrammar()
        ]).getGrammar();
    }
    getRuleName() {
        return reservedRuleNames.commaWhitespace({
            newLine: this.scopeState.settings.allowNewLines
                ? this.newLine
                : false,
            scopeSpaces: this.scopeState.settings.scopePadSpaces,
            nestingScope: this.scopeState.currentNestingScope
        });
    }
}
//# sourceMappingURL=GbnfCommaWhitespace.js.map