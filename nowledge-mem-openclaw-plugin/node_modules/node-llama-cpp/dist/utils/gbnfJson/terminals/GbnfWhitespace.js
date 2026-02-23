import { GbnfTerminal } from "../GbnfTerminal.js";
import { reservedRuleNames } from "./gbnfConsts.js";
import { GbnfVerbatimText } from "./GbnfVerbatimText.js";
export class GbnfWhitespace extends GbnfTerminal {
    scopeState;
    newLine;
    constructor(scopeState, { newLine = "before" } = {}) {
        super();
        this.scopeState = scopeState;
        this.newLine = newLine;
    }
    getGrammar() {
        return this._getGrammar();
    }
    getGrammarFromResolve() {
        return this._getGrammar(false);
    }
    _getGrammar(wrap = true) {
        if (this.scopeState.settings.allowNewLines && this.newLine !== false) {
            const values = [
                ...(this.newLine === "before"
                    ? ["[\\n]"]
                    : []),
                ...(this.scopeState.currentNestingScope === 0
                    ? []
                    : [
                        or([
                            verbatimTextRepetition(" ", this.scopeState.currentNestingScope * this.scopeState.settings.scopePadSpaces),
                            verbatimTextRepetition("\t", this.scopeState.currentNestingScope)
                        ])
                    ]),
                ...(this.newLine === "after"
                    ? ["[\\n]"]
                    : [])
            ];
            return or([
                values.join(" "),
                "[ ]?"
            ], wrap);
        }
        return "[ ]?";
    }
    getRuleName() {
        return reservedRuleNames.whitespace({
            newLine: this.scopeState.settings.allowNewLines
                ? this.newLine
                : false,
            scopeSpaces: this.scopeState.settings.scopePadSpaces,
            nestingScope: this.scopeState.currentNestingScope
        });
    }
}
function or(definitions, wrap = true) {
    if (!wrap)
        return definitions.join(" | ");
    return "(" + definitions.join(" | ") + ")";
}
function verbatimTextRepetition(text, count) {
    const textRepetitionGrammar = new GbnfVerbatimText(text.repeat(count)).getGrammar();
    if (count <= 1)
        return textRepetitionGrammar;
    const textRepetitionGrammarWithRepetition = new GbnfVerbatimText(text).getGrammar() + "{" + count + "}";
    if (textRepetitionGrammarWithRepetition.length < textRepetitionGrammar.length)
        return textRepetitionGrammarWithRepetition;
    return textRepetitionGrammar;
}
//# sourceMappingURL=GbnfWhitespace.js.map