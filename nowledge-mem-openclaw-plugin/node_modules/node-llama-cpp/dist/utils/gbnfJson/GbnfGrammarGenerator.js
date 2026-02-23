import { MultiKeyMap } from "lifecycle-utils";
export class GbnfGrammarGenerator {
    rules = new Map();
    ruleContentToRuleName = new Map();
    literalValueRuleNames = new Map();
    defRuleNames = new MultiKeyMap();
    defScopeDefs = new MultiKeyMap();
    usedRootRuleName = false;
    ruleId = 0;
    valueRuleId = 0;
    defRuleId = 0;
    generateRuleName() {
        const ruleId = this.ruleId;
        this.ruleId++;
        return `rule${ruleId}`;
    }
    generateRuleNameForLiteralValue(value) {
        const existingRuleName = this.literalValueRuleNames.get(value);
        if (existingRuleName != null)
            return existingRuleName;
        const ruleName = `val${this.valueRuleId}`;
        this.valueRuleId++;
        this.literalValueRuleNames.set(value, ruleName);
        return ruleName;
    }
    generateRuleNameForDef(defName, def) {
        const existingRuleName = this.defRuleNames.get([defName, def]);
        if (existingRuleName != null)
            return existingRuleName;
        const ruleName = `def${this.defRuleId}`;
        this.defRuleId++;
        this.defRuleNames.set([defName, def], ruleName);
        return ruleName;
    }
    registerDefs(scopeDefs) {
        for (const [defName, def] of Object.entries(scopeDefs))
            this.defScopeDefs.set([defName, def], scopeDefs);
    }
    generateGbnfFile(rootGrammar) {
        const rules = [{
                name: "root",
                grammar: rootGrammar
            }];
        for (const [ruleName, grammar] of this.rules.entries()) {
            if (grammar == null)
                continue;
            rules.push({
                name: ruleName,
                grammar
            });
        }
        const ruleStrings = rules.map((rule) => rule.name + " ::= " + rule.grammar);
        const gbnf = ruleStrings.join("\n");
        return gbnf;
    }
    getProposedLiteralValueRuleNameLength() {
        return `val${this.valueRuleId}`.length;
    }
}
//# sourceMappingURL=GbnfGrammarGenerator.js.map