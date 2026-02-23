import { GbnfTerminal } from "../GbnfTerminal.js";
import { GbnfJsonScopeState } from "../utils/GbnfJsonScopeState.js";
import { GbnfWhitespace } from "./GbnfWhitespace.js";
import { GbnfGrammar } from "./GbnfGrammar.js";
import { GbnfRepetition } from "./GbnfRepetition.js";
import { GbnfCommaWhitespace } from "./GbnfCommaWhitespace.js";
import { GbnfAnyJson } from "./GbnfAnyJson.js";
export class GbnfArray extends GbnfTerminal {
    items;
    prefixItems;
    minItems;
    maxItems;
    scopeState;
    constructor({ items, prefixItems, minItems = 0, maxItems, scopeState = new GbnfJsonScopeState() }) {
        super();
        this.items = items;
        this.prefixItems = prefixItems;
        this.minItems = Math.floor(minItems);
        this.maxItems = maxItems == null ? undefined : Math.floor(maxItems);
        this.scopeState = scopeState;
        if (this.prefixItems != null && this.minItems < this.prefixItems.length)
            this.minItems = this.prefixItems.length;
        else if (this.minItems < 0)
            this.minItems = 0;
        if (this.maxItems != null && this.maxItems < this.minItems)
            this.maxItems = this.minItems;
        else if (this.maxItems != null && this.maxItems < 0)
            this.maxItems = 0;
    }
    getGrammar(grammarGenerator) {
        const getWhitespaceRule = (newScope, newLine) => (newScope
            ? new GbnfWhitespace(this.scopeState.getForNewScope(), { newLine })
            : new GbnfWhitespace(this.scopeState, { newLine }));
        const getWhitespaceRuleName = (newScope, newLine) => (getWhitespaceRule(newScope, newLine).resolve(grammarGenerator));
        const getCommaWhitespaceRule = (newScope, newLine) => (newScope
            ? new GbnfCommaWhitespace(this.scopeState.getForNewScope(), { newLine })
            : new GbnfCommaWhitespace(this.scopeState, { newLine }));
        const getCommaWhitespaceRuleName = (newScope, newLine) => (getCommaWhitespaceRule(newScope, newLine).resolve(grammarGenerator));
        const arrayItemsGrammar = [];
        if (this.prefixItems != null && this.prefixItems.length > 0) {
            for (const item of this.prefixItems) {
                if (arrayItemsGrammar.length > 0)
                    arrayItemsGrammar.push(getCommaWhitespaceRuleName(true, "before"));
                arrayItemsGrammar.push(item.resolve(grammarGenerator));
            }
            if (this.minItems > this.prefixItems.length || this.maxItems == null || this.maxItems > this.prefixItems.length) {
                const restMinRepetitions = this.minItems - this.prefixItems.length;
                const restMaxRepetitions = this.maxItems == null
                    ? undefined
                    : this.maxItems - this.prefixItems.length;
                if (arrayItemsGrammar.length > 0)
                    arrayItemsGrammar.push(new GbnfRepetition({
                        value: new GbnfGrammar([
                            getCommaWhitespaceRuleName(true, "before"),
                            (this.items ?? new GbnfAnyJson()).resolve(grammarGenerator)
                        ], true),
                        minRepetitions: restMinRepetitions,
                        maxRepetitions: restMaxRepetitions
                    }).getGrammar(grammarGenerator));
                else
                    arrayItemsGrammar.push(new GbnfRepetition({
                        value: this.items ?? new GbnfAnyJson(),
                        separator: getCommaWhitespaceRule(true, "before"),
                        minRepetitions: restMinRepetitions,
                        maxRepetitions: restMaxRepetitions
                    }).getGrammar(grammarGenerator));
            }
        }
        else
            arrayItemsGrammar.push(new GbnfRepetition({
                value: this.items ?? new GbnfAnyJson(),
                separator: getCommaWhitespaceRule(true, "before"),
                minRepetitions: this.minItems,
                maxRepetitions: this.maxItems
            }).getGrammar(grammarGenerator));
        return new GbnfGrammar([
            '"["', getWhitespaceRuleName(true, "before"),
            new GbnfGrammar(arrayItemsGrammar).getGrammar(),
            getWhitespaceRuleName(false, "before"), '"]"'
        ]).getGrammar();
    }
}
//# sourceMappingURL=GbnfArray.js.map