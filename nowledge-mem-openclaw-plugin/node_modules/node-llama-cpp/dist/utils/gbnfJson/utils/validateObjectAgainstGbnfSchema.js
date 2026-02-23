import { isGbnfJsonArraySchema, isGbnfJsonConstSchema, isGbnfJsonEnumSchema, isGbnfJsonObjectSchema, isGbnfJsonOneOfSchema, isGbnfJsonBasicStringSchema, isGbnfJsonFormatStringSchema, isGbnfJsonRefSchema } from "../types.js";
import { DefScopeDefs, joinDefs } from "./defsScope.js";
export function validateObjectAgainstGbnfSchema(object, schema) {
    try {
        return validateObjectWithGbnfSchema(object, schema);
    }
    catch (err) {
        if (err instanceof TechnicalValidationError)
            throw new LlamaJsonSchemaValidationError(err.message, object, schema);
        throw err;
    }
}
export class LlamaJsonSchemaValidationError extends Error {
    object;
    schema;
    constructor(message, object, schema) {
        super(message);
        this.object = object;
        this.schema = schema;
    }
}
class TechnicalValidationError extends Error {
    constructor(message) {
        super(message);
    }
}
function validateObjectWithGbnfSchema(object, schema, defs = {}, defScopeDefs = new DefScopeDefs()) {
    if (isGbnfJsonRefSchema(schema))
        return validateRef(object, schema, defs, defScopeDefs);
    else if (isGbnfJsonArraySchema(schema))
        return validateArray(object, schema, defs, defScopeDefs);
    else if (isGbnfJsonObjectSchema(schema))
        return validateObject(object, schema, defs, defScopeDefs);
    else if (isGbnfJsonOneOfSchema(schema))
        return validateOneOf(object, schema, defs, defScopeDefs);
    else if (isGbnfJsonBasicStringSchema(schema))
        return validateBasicString(object, schema);
    else if (isGbnfJsonFormatStringSchema(schema))
        return validateFormatString(object, schema);
    else if (isGbnfJsonEnumSchema(schema))
        return validateEnum(object, schema);
    else if (isGbnfJsonConstSchema(schema))
        return validateConst(object, schema);
    if (schema.type instanceof Array) {
        for (const type of schema.type) {
            if (validateImmutableType(object, type))
                return true;
        }
        throw new TechnicalValidationError(`Expected one type of [${schema.type.map((type) => JSON.stringify(type)).join(", ")}] but got type "${object === null ? null : typeof object}"`);
    }
    if (validateImmutableType(object, schema.type))
        return true;
    throw new TechnicalValidationError(`Expected type "${schema.type}" but got "${object === null ? "null" : typeof object}"`);
}
function validateRef(object, schema, defs = {}, defScopeDefs = new DefScopeDefs()) {
    const currentDefs = joinDefs(defs, schema.$defs);
    defScopeDefs.registerDefs(currentDefs);
    const ref = schema.$ref;
    const referencePrefix = "#/$defs/";
    if (ref == null || !ref.startsWith(referencePrefix)) {
        // if the $ref is invalid, a warning was already shows when the grammar was generated,
        // so we don't perform validation on the object as it's considered an "any" type
        return true;
    }
    const defName = ref.slice(referencePrefix.length);
    const def = currentDefs[defName];
    if (def == null) {
        // if the $ref points to a non-existing def, a warning was already shows when the grammar was generated,
        // so we don't perform validation on the object as it's considered an "any" type
        return true;
    }
    const scopeDefs = defScopeDefs.defScopeDefs.get([defName, def]);
    return validateObjectWithGbnfSchema(object, def, scopeDefs ?? {}, defScopeDefs);
}
function validateArray(object, schema, defs = {}, defScopeDefs = new DefScopeDefs()) {
    if (!(object instanceof Array))
        throw new TechnicalValidationError(`Expected an array but got "${typeof object}"`);
    const minItems = Math.max(schema.minItems ?? 0, schema.prefixItems?.length ?? 0);
    const maxItems = schema.maxItems == null
        ? undefined
        : Math.max(schema.maxItems, minItems);
    if (object.length < minItems) {
        if (maxItems != null && minItems === maxItems)
            throw new TechnicalValidationError(`Expected exactly ${minItems} items but got ${object.length}`);
        throw new TechnicalValidationError(`Expected at least ${minItems} items but got ${object.length}`);
    }
    else if (maxItems != null && object.length > maxItems) {
        if (minItems === maxItems)
            throw new TechnicalValidationError(`Expected exactly ${minItems} items but got ${object.length}`);
        throw new TechnicalValidationError(`Expected at most ${maxItems} items but got ${object.length}`);
    }
    let res = true;
    let index = 0;
    const currentDefs = joinDefs(defs, schema.$defs);
    defScopeDefs.registerDefs(currentDefs);
    if (schema.prefixItems != null) {
        for (const item of schema.prefixItems) {
            res &&= validateObjectWithGbnfSchema(object[index], item, currentDefs, defScopeDefs);
            index++;
        }
    }
    if (schema.items != null) {
        for (; index < object.length; index++)
            res &&= validateObjectWithGbnfSchema(object[index], schema.items, currentDefs, defScopeDefs);
    }
    return res;
}
function validateObject(object, schema, defs = {}, defScopeDefs = new DefScopeDefs()) {
    if (typeof object !== "object" || object === null)
        throw new TechnicalValidationError(`Expected an object but got "${typeof object}"`);
    let res = true;
    const currentDefs = joinDefs(defs, schema.$defs);
    defScopeDefs.registerDefs(currentDefs);
    const objectKeys = Object.keys(object);
    const objectKeysSet = new Set(objectKeys);
    const schemaKeys = Object.keys(schema.properties ?? {});
    const schemaKeysSet = new Set(schemaKeys);
    const minProperties = Math.max(schema.minProperties ?? 0, schemaKeys.length);
    const maxProperties = schema.maxProperties == null
        ? undefined
        : Math.max(schema.maxProperties, minProperties);
    const extraKeys = objectKeys.filter((key) => !schemaKeysSet.has(key));
    if (extraKeys.length > 0) {
        if (schema.additionalProperties == null || schema.additionalProperties === false)
            throw new TechnicalValidationError(`Unexpected keys: ${extraKeys.map((key) => JSON.stringify(key)).join(", ")}`);
        else if (schema.additionalProperties !== true) {
            for (const key of extraKeys)
                res &&= validateObjectWithGbnfSchema(object[key], schema.additionalProperties, currentDefs, defScopeDefs);
        }
    }
    const missingKeys = schemaKeys.filter((key) => !objectKeysSet.has(key));
    if (missingKeys.length > 0)
        throw new TechnicalValidationError(`Missing keys: ${missingKeys.map((key) => JSON.stringify(key)).join(", ")}`);
    for (const key of schemaKeys)
        res &&= validateObjectWithGbnfSchema(object[key], schema.properties[key], currentDefs, defScopeDefs);
    if (schema.additionalProperties != null && schema.additionalProperties !== false) {
        if (objectKeys.length < minProperties) {
            if (maxProperties != null && minProperties === maxProperties)
                throw new TechnicalValidationError(`Expected exactly ${minProperties} properties but got ${objectKeys.length}`);
            throw new TechnicalValidationError(`Expected at least ${minProperties} properties but got ${objectKeys.length}`);
        }
        else if (maxProperties != null && objectKeys.length > maxProperties) {
            if (minProperties === maxProperties)
                throw new TechnicalValidationError(`Expected exactly ${minProperties} properties but got ${objectKeys.length}`);
            throw new TechnicalValidationError(`Expected at most ${maxProperties} properties but got ${objectKeys.length}`);
        }
    }
    return res;
}
function validateOneOf(object, schema, defs = {}, defScopeDefs = new DefScopeDefs()) {
    const currentDefs = joinDefs(defs, schema.$defs);
    defScopeDefs.registerDefs(currentDefs);
    for (const item of schema.oneOf) {
        try {
            return validateObjectWithGbnfSchema(object, item, currentDefs, defScopeDefs);
        }
        catch (err) {
            if (err instanceof TechnicalValidationError)
                continue;
            throw err;
        }
    }
    throw new TechnicalValidationError(`Expected one of ${schema.oneOf.length} schemas but got ${JSON.stringify(object)}`);
}
function validateBasicString(object, schema) {
    if (typeof object !== "string")
        throw new TechnicalValidationError(`Expected type "${schema.type}" but got "${object === null ? "null" : typeof object}"`);
    const minLength = Math.max(0, schema.minLength ?? 0);
    const maxLength = schema.maxLength == null
        ? undefined
        : Math.max(schema.maxLength, minLength);
    if (object.length < minLength) {
        if (minLength === maxLength)
            throw new TechnicalValidationError(`Expected exactly ${minLength} characters but got ${object.length}`);
        throw new TechnicalValidationError(`Expected at least ${minLength} characters but got ${object.length}`);
    }
    else if (maxLength != null && object.length > maxLength) {
        if (minLength === maxLength)
            throw new TechnicalValidationError(`Expected exactly ${minLength} characters but got ${object.length}`);
        throw new TechnicalValidationError(`Expected at most ${maxLength} characters but got ${object.length}`);
    }
    return true;
}
const dateRegex = /^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{3})?(Z|[+-]([01][0-9]|2[0-3])?:[0-5][0-9])$/;
const datetimeRegex = /^\d{4}-(0[1-9]|1[012])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{3})?(Z|[+-]([01][0-9]|2[0-3])?:[0-5][0-9])$/;
function validateFormatString(object, schema) {
    if (typeof object !== "string")
        throw new TechnicalValidationError(`Expected type "${schema.type}" but got "${object === null ? "null" : typeof object}"`);
    if (schema.format === "date") {
        if (object.match(dateRegex) != null)
            return true;
        throw new TechnicalValidationError(`Expected a valid date string but got ${JSON.stringify(object)}`);
    }
    else if (schema.format === "time") {
        if (object.match(timeRegex) != null)
            return true;
        throw new TechnicalValidationError(`Expected a valid time string but got ${JSON.stringify(object)}`);
    }
    else if (schema.format === "date-time") {
        if (object.match(datetimeRegex) != null)
            return true;
        throw new TechnicalValidationError(`Expected a valid date-time string but got ${JSON.stringify(object)}`);
    }
    throw new TechnicalValidationError(`Unknown format "${schema.format}"`);
}
function validateEnum(object, schema) {
    for (const value of schema.enum) {
        if (object === value)
            return true;
    }
    throw new TechnicalValidationError(`Expected one of [${schema.enum.map((item) => JSON.stringify(item)).join(", ")}] but got ${JSON.stringify(object)}`);
}
function validateConst(object, schema) {
    if (object === schema.const)
        return true;
    throw new TechnicalValidationError(`Expected ${JSON.stringify(schema.const)} but got ${JSON.stringify(object)}`);
}
function validateImmutableType(value, type) {
    if (type === "string") {
        return typeof value === "string";
    }
    else if (type === "number") {
        return typeof value === "number";
    }
    else if (type === "integer") {
        if (typeof value !== "number")
            return false;
        return value % 1 === 0;
    }
    else if (type === "boolean") {
        return typeof value === "boolean";
    }
    else if (type === "null") {
        return value === null;
    }
    else {
        void type;
    }
    throw new TechnicalValidationError(`Unknown immutable type ${JSON.stringify(type)}`);
}
//# sourceMappingURL=validateObjectAgainstGbnfSchema.js.map