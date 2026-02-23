import { GbnfGrammarGenerator } from "./GbnfGrammarGenerator.js";
export declare abstract class GbnfTerminal {
    private _ruleName;
    /** To be used only by `getRuleName` */
    protected generateRuleName(grammarGenerator: GbnfGrammarGenerator): string;
    protected getRuleName(grammarGenerator: GbnfGrammarGenerator): string;
    abstract getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
    protected getGrammarFromResolve(grammarGenerator: GbnfGrammarGenerator): string;
    private _getRootRuleName;
    resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar?: boolean): string;
}
