import { LlamaText } from "../utils/LlamaText.js";
import { Llama } from "../bindings/Llama.js";
import { Token } from "../types.js";
export type LlamaGrammarOptions = {
    /** GBNF grammar */
    grammar: string;
    /** Consider any of these as EOS for the generated text. Only supported by `LlamaChat` and `LlamaChatSession` */
    stopGenerationTriggers?: readonly (LlamaText | string | readonly (string | Token)[])[];
    /** Trim whitespace from the end of the generated text. Only supported by `LlamaChat` and `LlamaChatSession` */
    trimWhitespaceSuffix?: boolean;
    /**
     * Root rule name.
     *
     * Defaults to `"root"`.
     */
    rootRuleName?: string;
};
/**
 * @see [Using Grammar](https://node-llama-cpp.withcat.ai/guide/grammar) tutorial
 */
export declare class LlamaGrammar {
    /**
     * > GBNF files are supported.
     * > More info here: [
     * github:ggml-org/llama.cpp:grammars/README.md
     * ](https://github.com/ggml-org/llama.cpp/blob/f5fe98d11bdf9e7797bcfb05c0c3601ffc4b9d26/grammars/README.md)
     *
     * Prefer to create a new instance of this class by using `llama.createGrammar(...)`.
     * @deprecated Use `llama.createGrammar(...)` instead.
     * @param llama
     * @param options
     */
    constructor(llama: Llama, { grammar, stopGenerationTriggers, trimWhitespaceSuffix, rootRuleName }: LlamaGrammarOptions);
    get grammar(): string;
    get rootRuleName(): string;
    get stopGenerationTriggers(): readonly (string | import("../utils/LlamaText.js")._LlamaText | readonly (string | Token)[])[];
    get trimWhitespaceSuffix(): boolean;
    static getFor(llama: Llama, type: "json" | "json_arr" | "english" | "list" | "c" | "arithmetic" | "japanese" | "chess"): Promise<LlamaGrammar>;
}
