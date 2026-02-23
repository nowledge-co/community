import { GbnfTerminal } from "../GbnfTerminal.js";
export class GbnfRef extends GbnfTerminal {
    getValueTerminal;
    defName;
    def;
    constructor({ getValueTerminal, defName, def }) {
        super();
        this.getValueTerminal = getValueTerminal;
        this.defName = defName;
        this.def = def;
    }
    getGrammar(grammarGenerator) {
        return this.generateRuleName(grammarGenerator);
    }
    generateRuleName(grammarGenerator) {
        if (!grammarGenerator.defRuleNames.has([this.defName, this.def])) {
            const alreadyGeneratingGrammarForThisRef = grammarGenerator.defRuleNames.get([this.defName, this.def]) === null;
            if (alreadyGeneratingGrammarForThisRef)
                return grammarGenerator.generateRuleNameForDef(this.defName, this.def);
            grammarGenerator.defRuleNames.set([this.defName, this.def], null);
            const grammar = this.getValueTerminal().resolve(grammarGenerator);
            if (grammarGenerator.rules.has(grammar) && grammarGenerator.defRuleNames.get([this.defName, this.def]) === null) {
                grammarGenerator.defRuleNames.set([this.defName, this.def], grammar);
                return grammar;
            }
            const ruleName = grammarGenerator.generateRuleNameForDef(this.defName, this.def);
            grammarGenerator.rules.set(ruleName, grammar);
            grammarGenerator.ruleContentToRuleName.set(grammar, ruleName);
            return ruleName;
        }
        return grammarGenerator.generateRuleNameForDef(this.defName, this.def);
    }
}
//# sourceMappingURL=GbnfRef.js.map