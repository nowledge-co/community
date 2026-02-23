import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
import { GbnfJsonScopeState } from "../utils/GbnfJsonScopeState.js";
export declare class GbnfAnyJson extends GbnfTerminal {
    readonly scopeState: GbnfJsonScopeState;
    constructor(scopeState?: GbnfJsonScopeState);
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
    protected getRuleName(): string;
}
