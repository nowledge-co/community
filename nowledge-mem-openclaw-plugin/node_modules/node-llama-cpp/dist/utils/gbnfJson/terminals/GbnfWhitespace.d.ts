import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfJsonScopeState } from "../utils/GbnfJsonScopeState.js";
export declare class GbnfWhitespace extends GbnfTerminal {
    readonly scopeState: GbnfJsonScopeState;
    readonly newLine: "before" | "after" | false;
    constructor(scopeState: GbnfJsonScopeState, { newLine }?: {
        newLine?: "before" | "after" | false;
    });
    getGrammar(): string;
    protected getGrammarFromResolve(): string;
    private _getGrammar;
    protected getRuleName(): string;
}
