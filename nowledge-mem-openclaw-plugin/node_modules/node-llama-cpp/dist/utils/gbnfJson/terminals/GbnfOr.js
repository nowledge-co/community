import { GbnfTerminal } from "../GbnfTerminal.js";
import { grammarNoValue } from "./gbnfConsts.js";
export class GbnfOr extends GbnfTerminal {
    values;
    useRawGrammar;
    constructor(values, useRawGrammar = false) {
        super();
        this.values = values;
        this.useRawGrammar = useRawGrammar;
    }
    getGrammar(grammarGenerator) {
        const mappedValues = this.values
            .map((v) => (this.useRawGrammar
            ? v.getGrammar(grammarGenerator)
            : v.resolve(grammarGenerator)))
            .filter((value) => value !== "" && value !== grammarNoValue);
        if (mappedValues.length === 0)
            return grammarNoValue;
        else if (mappedValues.length === 1)
            return mappedValues[0];
        return "( " + mappedValues.join(" | ") + " )";
    }
    resolve(grammarGenerator, resolveAsRootGrammar = false) {
        const mappedValues = this.values
            .map((v) => v.resolve(grammarGenerator))
            .filter((value) => value !== "" && value !== grammarNoValue);
        if (mappedValues.length === 0)
            return grammarNoValue;
        else if (mappedValues.length === 1)
            return mappedValues[0];
        return super.resolve(grammarGenerator, resolveAsRootGrammar);
    }
}
//# sourceMappingURL=GbnfOr.js.map