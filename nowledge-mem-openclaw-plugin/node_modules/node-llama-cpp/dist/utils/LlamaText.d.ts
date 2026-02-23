import type { Token, Tokenizer } from "../types.js";
export type LlamaTextValue = string | SpecialTokensText | SpecialToken;
export type LlamaTextInputValue = LlamaTextValue | LlamaText | number | boolean | readonly LlamaTextInputValue[];
export type LlamaTextJSON = string | LlamaTextJSONValue[];
export type LlamaTextJSONValue = string | LlamaTextSpecialTokensTextJSON | LlamaTextSpecialTokenJSON;
export type LlamaTextSpecialTokensTextJSON = {
    type: "specialTokensText";
    value: string;
};
export type LlamaTextSpecialTokenJSON = {
    type: "specialToken";
    value: string;
};
/**
 * @see [Using `LlamaText`](https://node-llama-cpp.withcat.ai/guide/llama-text) tutorial
 */
declare class LlamaText {
    readonly values: readonly LlamaTextValue[];
    /**
     * Can also be called without `new`
     */
    constructor(...values: readonly LlamaTextInputValue[]);
    concat(value: LlamaTextInputValue): LlamaText;
    mapValues(mapper: (this: readonly LlamaTextValue[], value: LlamaTextValue, index: number, values: readonly LlamaTextValue[]) => LlamaTextInputValue): LlamaText;
    /**
     * Joins the values with the given separator.
     *
     * Note that the values are squashed when they are loaded into the `LlamaText`, so the separator is not added between adjacent strings.
     *
     * To add the separator on values before squashing them, use `LlamaText.joinValues` instead.
     */
    joinValues(separator: LlamaText | LlamaTextValue): LlamaText;
    toString(): string;
    toJSON(): LlamaTextJSON;
    tokenize(tokenizer: Tokenizer, options?: "trimLeadingSpace"): Token[];
    compare(other: LlamaText): boolean;
    trimStart(): LlamaText;
    trimEnd(): LlamaText;
    includes(value: LlamaText): boolean;
    static fromJSON(json: LlamaTextJSON): LlamaText;
    static compare(a: LlamaText, b: LlamaText): boolean;
    /**
     * Attempt to convert tokens to a `LlamaText` while preserving special tokens.
     *
     * Non-standard special tokens that don't have a text representation are ignored.
     */
    static fromTokens(tokenizer: Tokenizer, tokens: Token[]): LlamaText;
    /**
     * Join values with the given separator before squashing adjacent strings inside the values
     */
    static joinValues(separator: LlamaText | string, values: readonly LlamaTextInputValue[]): LlamaText;
    static isLlamaText(value: unknown): value is LlamaText;
}
type LlamaTextConstructor = Omit<typeof LlamaText, "prototype"> & {
    new (...values: readonly LlamaTextInputValue[]): LlamaText;
    (...values: readonly LlamaTextInputValue[]): LlamaText;
    readonly prototype: typeof LlamaText.prototype;
};
declare const LlamaTextConstructor: LlamaTextConstructor;
declare const _LlamaText: LlamaTextConstructor;
type _LlamaText = LlamaText;
export { _LlamaText as LlamaText, LlamaText as _LlamaText };
export declare class SpecialTokensText {
    readonly value: string;
    constructor(value: string);
    toString(): string;
    tokenize(tokenizer: Tokenizer, trimLeadingSpace?: boolean): Token[];
    tokenizeSpecialTokensOnly(tokenizer: Tokenizer): (string | Token)[];
    toJSON(): LlamaTextSpecialTokensTextJSON;
    static fromJSON(json: LlamaTextSpecialTokensTextJSON): SpecialTokensText;
    static isSpecialTokensTextJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokensTextJSON;
    /**
     * Wraps the value with a `SpecialTokensText` only if `shouldWrap` is true
     */
    static wrapIf(shouldWrap: boolean, value: string): SpecialTokensText | string;
}
export type BuiltinSpecialTokenValue = "BOS" | "EOS" | "NL" | "EOT" | "SEP";
export declare class SpecialToken {
    readonly value: BuiltinSpecialTokenValue;
    constructor(value: BuiltinSpecialTokenValue);
    toString(): BuiltinSpecialTokenValue;
    tokenize(tokenizer: Tokenizer): Token[];
    toJSON(): LlamaTextSpecialTokenJSON;
    static fromJSON(json: LlamaTextSpecialTokenJSON): SpecialToken;
    static isSpecialTokenJSON(value: LlamaTextJSONValue): value is LlamaTextSpecialTokenJSON;
    static getTokenToValueMap(tokenizer: Tokenizer): ReadonlyMap<Token | undefined, BuiltinSpecialTokenValue>;
}
export declare function isLlamaText(value: unknown): value is LlamaText;
/**
 * Tokenize the given input using the given tokenizer, whether it's a `string` or a `LlamaText`
 */
export declare function tokenizeText(text: string | LlamaText, tokenizer: Tokenizer): Token[];
