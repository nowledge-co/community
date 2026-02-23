import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
import { GbnfJsonSchema } from "../types.js";
export declare class GbnfRef extends GbnfTerminal {
    readonly getValueTerminal: () => GbnfTerminal;
    readonly defName: string;
    readonly def: GbnfJsonSchema;
    constructor({ getValueTerminal, defName, def }: {
        getValueTerminal: () => GbnfTerminal;
        defName: string;
        def: GbnfJsonSchema;
    });
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
    protected generateRuleName(grammarGenerator: GbnfGrammarGenerator): string;
}
