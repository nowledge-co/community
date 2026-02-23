import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
export declare class GbnfString extends GbnfTerminal {
    readonly minLength: number;
    readonly maxLength?: number;
    constructor({ minLength, maxLength }?: {
        minLength?: number;
        maxLength?: number;
    });
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
    protected getRuleName(): string;
}
