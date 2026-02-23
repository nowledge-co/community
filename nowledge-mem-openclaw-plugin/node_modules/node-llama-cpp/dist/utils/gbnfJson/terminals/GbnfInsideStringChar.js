import { GbnfTerminal } from "../GbnfTerminal.js";
import { reservedRuleNames } from "./gbnfConsts.js";
export class GbnfInsideStringChar extends GbnfTerminal {
    getGrammar() {
        return [
            negatedCharacterSet([
                '"',
                "\\\\",
                "\\x7F",
                "\\x00-\\x1F"
            ]),
            // escape sequences
            '"\\\\" ["\\\\/bfnrt]',
            '"\\\\u" [0-9a-fA-F]{4}'
        ].join(" | ");
    }
    getRuleName() {
        return reservedRuleNames.stringChar;
    }
}
function negatedCharacterSet(characterDefinitions) {
    return "[^" + characterDefinitions.join("") + "]";
}
//# sourceMappingURL=GbnfInsideStringChar.js.map