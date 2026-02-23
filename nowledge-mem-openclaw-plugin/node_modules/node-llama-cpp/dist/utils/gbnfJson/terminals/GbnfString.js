import { GbnfTerminal } from "../GbnfTerminal.js";
import { reservedRuleNames } from "./gbnfConsts.js";
import { GbnfRepetition } from "./GbnfRepetition.js";
import { GbnfInsideStringChar } from "./GbnfInsideStringChar.js";
export class GbnfString extends GbnfTerminal {
    minLength;
    maxLength;
    constructor({ minLength = 0, maxLength } = {}) {
        super();
        this.minLength = Math.floor(minLength ?? 0);
        this.maxLength = maxLength == null ? undefined : Math.floor(maxLength);
        if (this.minLength < 0)
            this.minLength = 0;
        if (this.maxLength != null && this.maxLength < this.minLength)
            this.maxLength = this.minLength;
    }
    getGrammar(grammarGenerator) {
        if (this.minLength == 0 && this.maxLength == null)
            return [
                '"\\""',
                new GbnfInsideStringChar().resolve(grammarGenerator) + "*",
                '"\\""'
            ].join(" ");
        else if (this.minLength == 0 && this.maxLength == 0)
            return '"\\"\\""';
        return [
            '"\\""',
            new GbnfRepetition({
                value: new GbnfInsideStringChar(),
                minRepetitions: this.minLength,
                maxRepetitions: this.maxLength
            }).getGrammar(grammarGenerator),
            '"\\""'
        ].join(" ");
    }
    getRuleName() {
        return reservedRuleNames.string({
            minLength: this.minLength,
            maxLength: this.maxLength
        });
    }
}
//# sourceMappingURL=GbnfString.js.map