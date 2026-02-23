import { GbnfTerminal } from "../GbnfTerminal.js";
import { reservedRuleNames } from "./gbnfConsts.js";
export class GbnfNumber extends GbnfTerminal {
    allowFractional;
    constructor({ allowFractional = true }) {
        super();
        this.allowFractional = allowFractional;
    }
    getGrammar() {
        const num = '"-"? ("0" | [1-9] [0-9]{0,15})';
        const exponent = ' ([eE] [-+]? ("0" | [1-9] [0-9]{0,15}))?';
        if (this.allowFractional)
            return num + ' ("." [0-9]{1,16})?' + exponent;
        return num + exponent;
    }
    getRuleName() {
        if (this.allowFractional)
            return reservedRuleNames.number.fractional;
        return reservedRuleNames.number.integer;
    }
}
//# sourceMappingURL=GbnfNumber.js.map