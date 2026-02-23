import { GbnfTerminal } from "../GbnfTerminal.js";
export class GbnfGrammar extends GbnfTerminal {
    grammar;
    resolveToRawGrammar;
    constructor(grammar, resolveToRawGrammar = false) {
        super();
        this.grammar = grammar;
        this.resolveToRawGrammar = resolveToRawGrammar;
    }
    getGrammar() {
        if (this.grammar instanceof Array)
            return this.grammar
                .filter((item) => item !== "")
                .join(" ");
        return this.grammar;
    }
    resolve(grammarGenerator, resolveAsRootGrammar = false) {
        if (this.resolveToRawGrammar)
            return this.getGrammar();
        return super.resolve(grammarGenerator, resolveAsRootGrammar);
    }
}
//# sourceMappingURL=GbnfGrammar.js.map