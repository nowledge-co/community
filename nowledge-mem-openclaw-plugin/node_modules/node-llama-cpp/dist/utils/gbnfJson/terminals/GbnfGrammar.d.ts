import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
export declare class GbnfGrammar extends GbnfTerminal {
    readonly grammar: string | string[];
    readonly resolveToRawGrammar: boolean;
    constructor(grammar: string | string[], resolveToRawGrammar?: boolean);
    getGrammar(): string;
    resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar?: boolean): string;
}
