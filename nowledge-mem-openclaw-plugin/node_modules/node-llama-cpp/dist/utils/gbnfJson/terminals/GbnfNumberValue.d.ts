import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
export declare class GbnfNumberValue extends GbnfTerminal {
    readonly value: number;
    constructor(value: number);
    getGrammar(): string;
    resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar?: boolean): string;
    protected generateRuleName(grammarGenerator: GbnfGrammarGenerator): string;
}
