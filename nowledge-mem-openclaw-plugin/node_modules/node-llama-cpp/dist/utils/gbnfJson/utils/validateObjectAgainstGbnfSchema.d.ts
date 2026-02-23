import { GbnfJsonSchema, GbnfJsonSchemaToType } from "../types.js";
export declare function validateObjectAgainstGbnfSchema(object: any, schema: unknown): boolean;
export declare function validateObjectAgainstGbnfSchema<T extends GbnfJsonSchema>(object: any, schema: T): object is GbnfJsonSchemaToType<T>;
export declare class LlamaJsonSchemaValidationError extends Error {
    readonly object: any;
    readonly schema: GbnfJsonSchema;
    constructor(message: string, object: any, schema: GbnfJsonSchema);
}
