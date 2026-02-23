import { GbnfTerminal } from "../GbnfTerminal.js";
import { reservedRuleNames } from "./gbnfConsts.js";
export class GbnfBoolean extends GbnfTerminal {
    getGrammar() {
        return this._getGrammar();
    }
    getGrammarFromResolve() {
        return this._getGrammar(false);
    }
    _getGrammar(wrap = true) {
        const values = ['"true"', '"false"'];
        if (wrap)
            return [
                "(", values.join(" | "), ")"
            ].join(" ");
        return values.join(" | ");
    }
    getRuleName() {
        return reservedRuleNames.boolean;
    }
}
//# sourceMappingURL=GbnfBoolean.js.map