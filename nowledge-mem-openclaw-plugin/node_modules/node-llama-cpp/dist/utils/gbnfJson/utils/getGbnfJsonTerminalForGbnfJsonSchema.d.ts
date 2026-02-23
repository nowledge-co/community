import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfGrammarGenerator } from "../GbnfGrammarGenerator.js";
import { GbnfJsonSchema } from "../types.js";
import { GbnfJsonScopeState } from "./GbnfJsonScopeState.js";
export declare function getGbnfJsonTerminalForGbnfJsonSchema(schema: GbnfJsonSchema, grammarGenerator: GbnfGrammarGenerator, scopeState?: GbnfJsonScopeState, defs?: Record<string, GbnfJsonSchema>): GbnfTerminal;
