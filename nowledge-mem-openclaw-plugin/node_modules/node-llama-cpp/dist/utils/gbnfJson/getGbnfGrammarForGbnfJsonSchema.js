import { getGbnfJsonTerminalForGbnfJsonSchema } from "./utils/getGbnfJsonTerminalForGbnfJsonSchema.js";
import { GbnfGrammarGenerator } from "./GbnfGrammarGenerator.js";
import { GbnfJsonScopeState } from "./utils/GbnfJsonScopeState.js";
export function getGbnfGrammarForGbnfJsonSchema(schema, { allowNewLines = true, scopePadSpaces = 4 } = {}) {
    const grammarGenerator = new GbnfGrammarGenerator();
    const scopeState = new GbnfJsonScopeState({ allowNewLines, scopePadSpaces });
    const rootTerminal = getGbnfJsonTerminalForGbnfJsonSchema(schema, grammarGenerator, scopeState);
    const rootGrammar = rootTerminal.resolve(grammarGenerator, true);
    return grammarGenerator.generateGbnfFile(rootGrammar + ` "${"\\n".repeat(4)}"` + " [\\n]*");
}
//# sourceMappingURL=getGbnfGrammarForGbnfJsonSchema.js.map