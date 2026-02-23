import path from "path";
import fs from "fs-extra";
import { getGrammarsFolder } from "../utils/getGrammarsFolder.js";
import { LlamaText } from "../utils/LlamaText.js";
/**
 * @see [Using Grammar](https://node-llama-cpp.withcat.ai/guide/grammar) tutorial
 */
export class LlamaGrammar {
    /** @internal */ _llama;
    /** @internal */ _grammar;
    /** @internal */ _stopGenerationTriggers;
    /** @internal */ _trimWhitespaceSuffix;
    /** @internal */ _grammarText;
    /** @internal */ _rootRuleName;
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
    constructor(llama, { grammar, stopGenerationTriggers = [], trimWhitespaceSuffix = false, rootRuleName = "root" }) {
        this._llama = llama;
        this._grammar = new this._llama._bindings.AddonGrammar(grammar, {
            addonExports: this._llama._bindings,
            rootRuleName
        });
        this._stopGenerationTriggers = stopGenerationTriggers ?? [];
        this._trimWhitespaceSuffix = trimWhitespaceSuffix;
        this._grammarText = grammar;
        this._rootRuleName = rootRuleName;
    }
    get grammar() {
        return this._grammarText;
    }
    get rootRuleName() {
        return this._rootRuleName;
    }
    get stopGenerationTriggers() {
        return this._stopGenerationTriggers;
    }
    get trimWhitespaceSuffix() {
        return this._trimWhitespaceSuffix;
    }
    /**
     * Test if the given text is compatible with the grammar.
     * @internal
     */
    _testText(text) {
        return this._grammar.isTextCompatible(String(text));
    }
    static async getFor(llama, type) {
        const grammarsFolder = await getGrammarsFolder(llama.buildType);
        const grammarFile = path.join(grammarsFolder, type + ".gbnf");
        if (await fs.pathExists(grammarFile)) {
            const grammar = await fs.readFile(grammarFile, "utf8");
            return new LlamaGrammar(llama, {
                grammar,
                stopGenerationTriggers: [LlamaText(["\n".repeat((type === "json" || type === "json_arr")
                            ? 4
                            : 10)])], // this is a workaround for the model not stopping to generate text,
                trimWhitespaceSuffix: true
            });
        }
        throw new Error(`Grammar file for type "${type}" was not found in "${grammarsFolder}"`);
    }
}
//# sourceMappingURL=LlamaGrammar.js.map