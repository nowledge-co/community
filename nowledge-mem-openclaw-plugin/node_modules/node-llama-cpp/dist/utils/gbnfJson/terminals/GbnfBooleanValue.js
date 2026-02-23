import { GbnfTerminal } from "../GbnfTerminal.js";
export class GbnfBooleanValue extends GbnfTerminal {
    value;
    constructor(value) {
        super();
        this.value = value;
    }
    getGrammar() {
        if (this.value)
            return '"true"';
        return '"false"';
    }
    resolve() {
        return this.getGrammar();
    }
}
//# sourceMappingURL=GbnfBooleanValue.js.map