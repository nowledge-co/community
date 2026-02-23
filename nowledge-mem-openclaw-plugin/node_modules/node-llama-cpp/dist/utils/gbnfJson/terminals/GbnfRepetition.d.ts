import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
export declare class GbnfRepetition extends GbnfTerminal {
    readonly value: GbnfTerminal;
    readonly separator?: GbnfTerminal;
    readonly minRepetitions: number;
    readonly maxRepetitions: number | null;
    constructor({ value, separator, minRepetitions, maxRepetitions }: {
        value: GbnfTerminal;
        separator?: GbnfTerminal;
        minRepetitions?: number;
        maxRepetitions?: number | null;
    });
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
}
