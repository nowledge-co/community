import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
export declare class GbnfStringValue extends GbnfTerminal {
    readonly value: string;
    constructor(value: string);
    getGrammar(): string;
    protected generateRuleName(grammarGenerator: GbnfGrammarGenerator): string;
}
