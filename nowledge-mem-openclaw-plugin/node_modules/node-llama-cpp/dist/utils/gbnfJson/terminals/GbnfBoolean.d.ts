import { GbnfTerminal } from "../GbnfTerminal.js";
export declare class GbnfBoolean extends GbnfTerminal {
    getGrammar(): string;
    protected getGrammarFromResolve(): string;
    private _getGrammar;
    protected getRuleName(): string;
}
