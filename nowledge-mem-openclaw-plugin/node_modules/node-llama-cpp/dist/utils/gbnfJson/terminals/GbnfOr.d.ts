import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
export declare class GbnfOr extends GbnfTerminal {
    readonly values: readonly GbnfTerminal[];
    readonly useRawGrammar: boolean;
    constructor(values: readonly GbnfTerminal[], useRawGrammar?: boolean);
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
    resolve(grammarGenerator: GbnfGrammarGenerator, resolveAsRootGrammar?: boolean): string;
}
