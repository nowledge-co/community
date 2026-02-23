import { GbnfJsonDefList, GbnfJsonSchema, GbnfJsonSchemaToType } from "../utils/gbnfJson/types.js";
import { Llama } from "../bindings/Llama.js";
import { LlamaGrammar } from "./LlamaGrammar.js";
/**
 * @see [Using a JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#json-schema) tutorial
 * @see [Reducing Hallucinations When Using JSON Schema Grammar](https://node-llama-cpp.withcat.ai/guide/grammar#reducing-json-schema-hallucinations) tutorial
 */
export declare class LlamaJsonSchemaGrammar<const T extends GbnfJsonSchema<Defs>, const Defs extends GbnfJsonDefList<Defs> = Record<any, any>> extends LlamaGrammar {
    private readonly _schema;
    /**
     * Prefer to create a new instance of this class by using `llama.createGrammarForJsonSchema(...)`.
     * @deprecated Use `llama.createGrammarForJsonSchema(...)` instead.
     */
    constructor(llama: Llama, schema: Readonly<T> & GbnfJsonSchema<Defs>);
    get schema(): Readonly<T>;
    parse(json: string): GbnfJsonSchemaToType<T>;
}
