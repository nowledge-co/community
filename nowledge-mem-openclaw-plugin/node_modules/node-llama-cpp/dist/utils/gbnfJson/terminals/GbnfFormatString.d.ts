import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
import { GbnfJsonFormatStringSchema } from "../types.js";
export declare class GbnfFormatString extends GbnfTerminal {
    readonly format: GbnfJsonFormatStringSchema["format"];
    constructor(format: GbnfJsonFormatStringSchema["format"]);
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
    protected getRuleName(): string;
    private _getDateGrammar;
    private _getTimeGrammar;
}
