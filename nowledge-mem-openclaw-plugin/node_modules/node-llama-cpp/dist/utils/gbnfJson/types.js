export function isGbnfJsonConstSchema(schema) {
    return schema.const !== undefined;
}
export function isGbnfJsonEnumSchema(schema) {
    return schema.enum != null;
}
export function isGbnfJsonOneOfSchema(schema) {
    return schema.oneOf != null;
}
export function isGbnfJsonBasicStringSchema(schema) {
    return schema.type === "string" && schema.format == null;
}
export function isGbnfJsonFormatStringSchema(schema) {
    return schema.type === "string" && schema.format != null;
}
export function isGbnfJsonObjectSchema(schema) {
    return schema.type === "object";
}
export function isGbnfJsonArraySchema(schema) {
    return schema.type === "array";
}
export function isGbnfJsonRefSchema(schema) {
    return typeof schema.$ref === "string";
}
export function isGbnfJsonBasicSchemaIncludesType(schema, type) {
    if (schema.type instanceof Array)
        return schema.type.includes(type);
    return schema.type === type;
}
//# sourceMappingURL=types.js.map