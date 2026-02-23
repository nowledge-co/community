import { getGbnfGrammarForGbnfJsonSchema } from "../utils/gbnfJson/getGbnfGrammarForGbnfJsonSchema.js";
import { validateObjectAgainstGbnfSchema } from "../utils/gbnfJson/utils/validateObjectAgainstGbnfSchema.js";
import { LlamaText } from "../utils/LlamaText.js";
import { LlamaGrammar } from "./LlamaGrammar.js";
/* eslint-disable @stylistic/max-len */
/**
 * @see [Using a JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#json-schema) tutorial
 * @see [Reducing Hallucinations When Using JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#reducing-json-schema-hallucinations) tutorial
 */
export class LlamaJsonSchemaGrammar extends LlamaGrammar {
    _schema;
    /**
     * Prefer to create a new instance of this class by using `llama.createGrammarForJsonSchema(...)`.
     * @deprecated Use `llama.createGrammarForJsonSchema(...)` instead.
     */
    constructor(llama, schema) {
        const grammar = getGbnfGrammarForGbnfJsonSchema(schema);
        super(llama, {
            grammar,
            stopGenerationTriggers: [LlamaText(["\n".repeat(4)])],
            trimWhitespaceSuffix: true
        });
        this._schema = schema;
    }
    get schema() {
        return this._schema;
    }
    parse(json) {
        const parsedJson = JSON.parse(json);
        validateObjectAgainstGbnfSchema(parsedJson, this._schema);
        return parsedJson;
    }
}
/* eslint-enable @stylistic/max-len */
//# sourceMappingURL=LlamaJsonSchemaGrammar.js.map