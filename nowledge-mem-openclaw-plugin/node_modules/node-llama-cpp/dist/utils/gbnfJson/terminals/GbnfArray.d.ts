import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
import { GbnfJsonScopeState } from "../utils/GbnfJsonScopeState.js";
export declare class GbnfArray extends GbnfTerminal {
    readonly items?: GbnfTerminal;
    readonly prefixItems?: GbnfTerminal[];
    readonly minItems: number;
    readonly maxItems?: number;
    readonly scopeState: GbnfJsonScopeState;
    constructor({ items, prefixItems, minItems, maxItems, scopeState }: {
        items?: GbnfTerminal;
        prefixItems?: GbnfTerminal[];
        minItems?: number;
        maxItems?: number;
        scopeState: GbnfJsonScopeState;
    });
    getGrammar(grammarGenerator: GbnfGrammarGenerator): string;
}
