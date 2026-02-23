import { pushAll } from "./pushAll.js";
/**
 * @see [Using `LlamaText`](https://node-llama-cpp.withcat.ai/guide/llama-text) tutorial
 */
class LlamaText {
    values;
    /**
     * Can also be called without `new`
     */
    constructor(...values) {
        // the constructor logic is copied to `LlamaTextConstructor` to make the constructor callable as a normal function
        this.values = createHistoryFromStringsAndValues(values);
    }
    concat(value) {
        return new LlamaTextConstructor([...this.values, value]);
    }
    mapValues(mapper) {
        return new LlamaTextConstructor(this.values.map(mapper));
    }
    /**
     * Joins the values with the given separator.
     *
     * Note that the values are squashed when they are loaded into the `LlamaText`, so the separator is not added between adjacent strings.
     *
     * To add the separator on values before squashing them, use `LlamaText.joinValues` instead.
     */
    joinValues(separator) {
        const newValues = [];
        for (let i = 0; i < this.values.length; i++) {
            newValues.push(this.values[i]);
            if (i !== this.values.length - 1) {
                if (isLlamaText(separator))
                    pushAll(newValues, separator.values);
                else
                    newValues.push(separator);
            }
        }
        return new LlamaTextConstructor(newValues);
    }
    toString() {
        return this.values
            .map((value) => {
            if (value instanceof SpecialToken)
                return value.toString();
            else if (value instanceof SpecialTokensText)
                return value.toString();
            else
                return value;
        })
            .join("");
    }
    toJSON() {
        if (this.values.length === 1 && typeof this.values[0] === "string")
            return this.values[0];
        else if (this.values.length === 0)
            return "";
        return this.values.map((value) => {
            if (value instanceof SpecialToken)
                return value.toJSON();
            else if (value instanceof SpecialTokensText)
                return value.toJSON();
            else
                return value;
        });
    }
    tokenize(tokenizer, options) {
        let textToTokenize = "";
        const res = [];
        const hasContent = () => (res.length > 0 || textToTokenize.length > 0);
        const resolveTokenizerOptions = () => (hasContent() ? "trimLeadingSpace" : options);
        for (const value of this.values) {
            if (value instanceof SpecialToken) {
                pushAll(res, tokenizer(textToTokenize, false, resolveTokenizerOptions()));
                pushAll(res, value.tokenize(tokenizer));
                textToTokenize = "";
            }
            else if (value instanceof SpecialTokensText) {
                pushAll(res, tokenizer(textToTokenize, false, resolveTokenizerOptions()));
                pushAll(res, value.tokenize(tokenizer, hasContent() || options === "trimLeadingSpace"));
                textToTokenize = "";
            }
            else
                textToTokenize += value;
        }
        pushAll(res, tokenizer(textToTokenize, false, resolveTokenizerOptions()));
        return res;
    }
    compare(other) {
        return LlamaTextConstructor.compare(this, other);
    }
    trimStart() {
        const newValues = this.values.slice();
        while (newValues.length > 0) {
            const firstValue = newValues[0];
            if (firstValue instanceof SpecialToken)
                break;
            if (firstValue instanceof SpecialTokensText) {
                const newValue = firstValue.value.trimStart();
                if (newValue === "") {
                    newValues.shift();
                    continue;
                }
                else if (newValue !== firstValue.value) {
                    newValues[0] = new SpecialTokensText(newValue);
                    break;
                }
                break;
            }
            else if (typeof firstValue === "string") {
                const newValue = firstValue.trimStart();
                if (newValue === "") {
                    newValues.shift();
                    continue;
                }
                else if (newValue !== firstValue) {
                    newValues[0] = newValue;
                    break;
                }
                break;
            }
            else
                void firstValue;
        }
        return new LlamaTextConstructor(newValues);
    }
    trimEnd() {
        const newValues = this.values.slice();
        while (newValues.length > 0) {
            const lastValue = newValues[newValues.length - 1];
            if (lastValue instanceof SpecialToken)
                break;
            if (lastValue instanceof SpecialTokensText) {
                const newValue = lastValue.value.trimEnd();
                if (newValue === "") {
                    newValues.pop();
                    continue;
                }
                else if (newValue !== lastValue.value) {
                    newValues[newValues.length - 1] = new SpecialTokensText(newValue);
                    break;
                }
                break;
            }
            else if (typeof lastValue === "string") {
                const newValue = lastValue.trimEnd();
                if (newValue === "") {
                    newValues.pop();
                    continue;
                }
                else if (newValue !== lastValue) {
                    newValues[newValues.length - 1] = newValue;
                    break;
                }
                break;
            }
            else
                void lastValue;
        }
        return new LlamaTextConstructor(newValues);
    }
    includes(value) {
        for (let i = 0; i <= this.values.length - value.values.length; i++) {
            const thisValue = this.values[i];
            let startMatch = compareLlamaTextValues(thisValue, value.values[0]);
            if (!startMatch && thisValue instanceof SpecialTokensText && value.values[0] instanceof SpecialTokensText) {
                startMatch = value.values.length > 1
                    ? thisValue.value.endsWith(value.values[0].value)
                    : thisValue.value.includes(value.values[0].value);
            }
            if (!startMatch && typeof thisValue === "string" && typeof value.values[0] === "string") {
                startMatch = value.values.length > 1
                    ? thisValue.endsWith(value.values[0])
                    : thisValue.includes(value.values[0]);
            }
            if (startMatch) {
                let j = 1;
                for (; j < value.values.length; j++) {
                    const thisValue = this.values[i + j];
                    const valueValue = value.values[j];
                    let endMatch = compareLlamaTextValues(thisValue, valueValue);
                    if (!endMatch && thisValue instanceof SpecialTokensText && valueValue instanceof SpecialTokensText) {
                        endMatch = value.values.length - 1 === j
                            ? thisValue.value.startsWith(valueValue.value)
                            : thisValue.value === valueValue.value;
                    }
                    if (!endMatch && typeof thisValue === "string" && typeof valueValue === "string") {
                        endMatch = value.values.length - 1 === j
                            ? thisValue.startsWith(valueValue)
                            : thisValue === valueValue;
                    }
                    if (!endMatch)
                        break;
                }
                if (j === value.values.length)
                    return true;
            }
        }
        return false;
    }
    /** @internal */
    [Symbol.for("nodejs.util.inspect.custom")](depth, inspectOptions, inspect) {
        const inspectFunction = inspect ?? inspectOptions?.inspect;
        if (inspectFunction == null)
            return JSON.stringify(this.toJSON(), undefined, 4);
        return "LlamaText(" + inspectFunction(this.values, {
            ...(inspectOptions ?? {}),
            depth: depth == null
                ? undefined
                : Math.max(0, depth - 1)
        }) + ")";
    }
    static fromJSON(json) {
        // assigned to `LlamaTextConstructor` manually to expose this static method
        if (typeof json === "string")
            return new LlamaTextConstructor(json);
        return new LlamaTextConstructor(json.map((value) => {
            if (typeof value === "string")
                return value;
            else if (SpecialToken.isSpecialTokenJSON(value))
                return SpecialToken.fromJSON(value);
            else if (SpecialTokensText.isSpecialTokensTextJSON(value))
                return SpecialTokensText.fromJSON(value);
            else {
                void value;
                throw new Error(`Unknown value type: ${value}`);
            }
        }));
    }
    static compare(a, b) {
        // assigned to `LlamaTextConstructor` manually to expose this static method
        if (!isLlamaText(a) || !isLlamaText(b))
            return false;
        if (a.values.length !== b.values.length)
            return false;
        for (let i = 0; i < a.values.length; i++) {
            if (!compareLlamaTextValues(a.values[i], b.values[i]))
                return false;
        }
        return true;
    }
    /**
     * Attempt to convert tokens to a `LlamaText` while preserving special tokens.
     *
     * Non-standard special tokens that don't have a text representation are ignored.
     */
    static fromTokens(tokenizer, tokens) {
        // assigned to `LlamaTextConstructor` manually to expose this static method
        const res = [];
        const pendingTokens = [];
        const addPendingTokens = () => {
            if (pendingTokens.length === 0)
                return;
            res.push(tokenizer.detokenize(pendingTokens, false));
            pendingTokens.length = 0;
        };
        const builtinTokens = SpecialToken.getTokenToValueMap(tokenizer);
        for (const token of tokens) {
            if (token == null)
                continue;
            const builtinTokenValue = builtinTokens.get(token);
            if (builtinTokenValue != null) {
                addPendingTokens();
                res.push(new SpecialToken(builtinTokenValue));
                continue;
            }
            const regularText = tokenizer.detokenize([token], false);
            const retokenizedRegularText = tokenizer(regularText, false, "trimLeadingSpace");
            if (retokenizedRegularText.length === 1 && retokenizedRegularText[0] === token) {
                pendingTokens.push(token);
                continue;
            }
            const specialText = tokenizer.detokenize([token], true);
            const retokenizedSpecialText = tokenizer(specialText, true, "trimLeadingSpace");
            if (retokenizedSpecialText.length === 1 && retokenizedSpecialText[0] === token) {
                addPendingTokens();
                res.push(new SpecialTokensText(specialText));
                continue;
            }
            pendingTokens.push(token);
        }
        addPendingTokens();
        return new LlamaTextConstructor(res);
    }
    /**
     * Join values with the given separator before squashing adjacent strings inside the values
     */
    static joinValues(separator, values) {
        // assigned to `LlamaTextConstructor` manually to expose this static method
        const newValues = [];
        for (let i = 0; i < values.length; i++) {
            const value = values[i];
            if (i !== 0)
                newValues.push(separator);
            newValues.push(value);
        }
        return new LlamaTextConstructor(newValues);
    }
    static isLlamaText(value) {
        // assigned to `LlamaTextConstructor` manually to expose this static method
        if (value instanceof LlamaTextConstructor || value instanceof LlamaText)
            return true;
        try {
            // detect a `LlamaText` created from a different module import
            return value != null && Object.getPrototypeOf(value)?._type === "LlamaText";
        }
        catch (err) {
            return false;
        }
    }
}
Object.defineProperty(LlamaText.prototype, "_type", {
    enumerable: false,
    configurable: false,
    value: "LlamaText"
});
const LlamaTextConstructor = function LlamaText(...values) {
    // this makes the constructor callable also as a normal function
    if (new.target == null)
        return new LlamaTextConstructor(...values);
    this.values = createHistoryFromStringsAndValues(values);
    return this;
};
LlamaTextConstructor.prototype = Object.create(LlamaText.prototype);
LlamaTextConstructor.prototype.constructor = LlamaTextConstructor;
LlamaTextConstructor.fromJSON = LlamaText.fromJSON;
LlamaTextConstructor.compare = LlamaText.compare;
LlamaTextConstructor.fromTokens = LlamaText.fromTokens;
LlamaTextConstructor.joinValues = LlamaText.joinValues;
LlamaTextConstructor.isLlamaText = LlamaText.isLlamaText;
const _LlamaText = LlamaTextConstructor;
export { _LlamaText as LlamaText, LlamaText as _LlamaText };
export class SpecialTokensText {
    value;
    constructor(value) {
        this.value = value;
    }
    toString() {
        return this.value;
    }
    tokenize(tokenizer, trimLeadingSpace = false) {
        return tokenizer(this.value, true, trimLeadingSpace ? "trimLeadingSpace" : undefined);
    }
    tokenizeSpecialTokensOnly(tokenizer) {
        const tokens = this.tokenize(tokenizer, true);
        const res = [];
        const pendingTextTokens = [];
        for (const token of tokens) {
            if (tokenizer.isSpecialToken(token)) {
                if (pendingTextTokens.length !== 0) {
                    res.push(tokenizer.detokenize(pendingTextTokens, false));
                    pendingTextTokens.length = 0;
                }
                res.push(token);
            }
            else
                pendingTextTokens.push(token);
        }
        if (pendingTextTokens.length !== 0)
            res.push(tokenizer.detokenize(pendingTextTokens, false));
        return res;
    }
    toJSON() {
        return {
            type: "specialTokensText",
            value: this.value
        };
    }
    /** @internal */
    [Symbol.for("nodejs.util.inspect.custom")](depth, inspectOptions, inspect) {
        const inspectFunction = inspect ?? inspectOptions?.inspect;
        if (inspectFunction == null)
            return JSON.stringify(this.toJSON(), undefined, 4);
        return "new SpecialTokensText(" + inspectFunction(this.value, {
            ...(inspectOptions ?? {}),
            depth: depth == null
                ? undefined
                : Math.max(0, depth - 1)
        }) + ")";
    }
    static fromJSON(json) {
        if (SpecialTokensText.isSpecialTokensTextJSON(json))
            return new SpecialTokensText(json.value);
        throw new Error(`Invalid JSON for SpecialTokensText: ${JSON.stringify(json)}`);
    }
    static isSpecialTokensTextJSON(value) {
        return value != null && typeof value === "object" && value.type === "specialTokensText";
    }
    /**
     * Wraps the value with a `SpecialTokensText` only if `shouldWrap` is true
     */
    static wrapIf(shouldWrap, value) {
        if (shouldWrap)
            return new SpecialTokensText(value);
        else
            return value;
    }
}
export class SpecialToken {
    value;
    constructor(value) {
        this.value = value;
    }
    toString() {
        return this.value;
    }
    tokenize(tokenizer) {
        return tokenizer(this.value, "builtin");
    }
    toJSON() {
        return {
            type: "specialToken",
            value: this.value
        };
    }
    /** @internal */
    [Symbol.for("nodejs.util.inspect.custom")](depth, inspectOptions, inspect) {
        const inspectFunction = inspect ?? inspectOptions?.inspect;
        if (inspectFunction == null)
            return JSON.stringify(this.toJSON(), undefined, 4);
        return "new SpecialToken(" + inspectFunction(this.value, {
            ...(inspectOptions ?? {}),
            depth: depth == null
                ? undefined
                : Math.max(0, depth - 1)
        }) + ")";
    }
    static fromJSON(json) {
        if (SpecialToken.isSpecialTokenJSON(json))
            return new SpecialToken(json.value);
        throw new Error(`Invalid JSON for SpecialToken: ${JSON.stringify(json)}`);
    }
    static isSpecialTokenJSON(value) {
        return value != null && typeof value === "object" && value.type === "specialToken";
    }
    static getTokenToValueMap(tokenizer) {
        const supportedValues = [
            "BOS", "EOS", "NL", "EOT", "SEP"
        ];
        void 0;
        const res = new Map(supportedValues.map((value) => ([tokenizer(value, "builtin")[0], value])));
        res.delete(undefined);
        return res;
    }
}
export function isLlamaText(value) {
    return LlamaText.isLlamaText(value);
}
/**
 * Tokenize the given input using the given tokenizer, whether it's a `string` or a `LlamaText`
 */
export function tokenizeText(text, tokenizer) {
    if (typeof text === "string")
        return tokenizer(text, false);
    else
        return text.tokenize(tokenizer);
}
function createHistoryFromStringsAndValues(values) {
    function addItemToRes(res, item) {
        if (item === undefined || item === "" || (item instanceof SpecialTokensText && item.value === ""))
            return res;
        else if (typeof item === "string" || item instanceof SpecialTokensText || item instanceof SpecialToken) {
            res.push(item);
            return res;
        }
        else if (isLlamaText(item)) {
            for (const value of item.values)
                res.push(value);
            return res;
        }
        else if (item instanceof Array) {
            for (const value of item) {
                if (isLlamaText(value)) {
                    for (const innerValue of value.values)
                        res.push(innerValue);
                }
                else if (value === "" || (value instanceof SpecialTokensText && value.value === ""))
                    continue;
                else if (value instanceof Array)
                    addItemToRes(res, value);
                else if (typeof value === "number" || typeof value === "boolean")
                    res.push(String(value));
                else
                    res.push(value);
            }
            return res;
        }
        else if (typeof item === "number" || typeof item === "boolean") {
            res.push(String(item));
            return res;
        }
        return item;
    }
    function squashAdjacentItems(res, item) {
        if (res.length === 0) {
            res.push(item);
            return res;
        }
        const lastItem = res[res.length - 1];
        if (lastItem instanceof SpecialToken || item instanceof SpecialToken) {
            res.push(item);
            return res;
        }
        if (typeof lastItem === "string" && typeof item === "string") {
            res[res.length - 1] += item;
            return res;
        }
        else if (lastItem instanceof SpecialTokensText && item instanceof SpecialTokensText) {
            res[res.length - 1] = new SpecialTokensText(lastItem.value + item.value);
            return res;
        }
        res.push(item);
        return res;
    }
    return values
        .reduce(addItemToRes, [])
        .reduce(squashAdjacentItems, []);
}
function compareLlamaTextValues(a, b) {
    if (a instanceof SpecialTokensText && b instanceof SpecialTokensText)
        return a.value === b.value;
    else if (a instanceof SpecialToken && b instanceof SpecialToken)
        return a.value === b.value;
    else if (a !== b)
        return false;
    return true;
}
//# sourceMappingURL=LlamaText.js.map