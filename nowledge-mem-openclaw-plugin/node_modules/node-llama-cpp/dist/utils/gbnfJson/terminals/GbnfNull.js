import { GbnfTerminal } from "../GbnfTerminal.js";
import { reservedRuleNames } from "./gbnfConsts.js";
export class GbnfNull extends GbnfTerminal {
    getGrammar() {
        return '"null"';
    }
    getRuleName() {
        return reservedRuleNames.null;
    }
}
//# sourceMappingURL=GbnfNull.js.map