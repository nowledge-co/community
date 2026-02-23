export class GbnfTerminal {
    _ruleName = null;
    /** To be used only by `getRuleName` */
    generateRuleName(grammarGenerator) {
        return grammarGenerator.generateRuleName();
    }
    getRuleName(grammarGenerator) {
        if (this._ruleName != null)
            return this._ruleName;
        const ruleName = this.generateRuleName(grammarGenerator);
        this._ruleName = ruleName;
        return ruleName;
    }
    getGrammarFromResolve(grammarGenerator) {
        return this.getGrammar(grammarGenerator);
    }
    _getRootRuleName(grammarGenerator) {
        if (this._ruleName != null)
            return this._ruleName;
        const ruleName = grammarGenerator.usedRootRuleName
            ? this.getRuleName(grammarGenerator)
            : "root";
        this._ruleName = ruleName;
        if (ruleName === "root")
            grammarGenerator.usedRootRuleName = true;
        return ruleName;
    }
    resolve(grammarGenerator, resolveAsRootGrammar = false) {
        if (this._ruleName != null)
            return this._ruleName;
        const grammar = this.getGrammarFromResolve(grammarGenerator);
        const existingRuleName = grammarGenerator.ruleContentToRuleName.get(grammar);
        if (existingRuleName != null) {
            this._ruleName = existingRuleName;
            return existingRuleName;
        }
        const ruleName = resolveAsRootGrammar
            ? this._getRootRuleName(grammarGenerator)
            : this.getRuleName(grammarGenerator);
        if (resolveAsRootGrammar)
            return grammar;
        if (grammar === ruleName) {
            this._ruleName = ruleName;
            return ruleName;
        }
        if (!grammarGenerator.rules.has(ruleName)) {
            grammarGenerator.rules.set(ruleName, grammar);
            grammarGenerator.ruleContentToRuleName.set(grammar, ruleName);
        }
        this._ruleName = ruleName;
        return ruleName;
    }
}
//# sourceMappingURL=GbnfTerminal.js.map