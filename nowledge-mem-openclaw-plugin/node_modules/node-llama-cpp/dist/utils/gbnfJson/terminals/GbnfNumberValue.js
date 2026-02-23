import { GbnfTerminal } from "../GbnfTerminal.js";
export class GbnfNumberValue extends GbnfTerminal {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    getGrammar() {
        return '"' + JSON.stringify(this.value) + '"';
    }
    resolve(grammarGenerator, resolveAsRootGrammar = false) {
        const grammar = this.getGrammar();
        if (grammar.length <= grammarGenerator.getProposedLiteralValueRuleNameLength())
            return grammar;
        return super.resolve(grammarGenerator, resolveAsRootGrammar);
    }
    generateRuleName(grammarGenerator) {
        return grammarGenerator.generateRuleNameForLiteralValue(this.value);
    }
}
//# sourceMappingURL=GbnfNumberValue.js.map