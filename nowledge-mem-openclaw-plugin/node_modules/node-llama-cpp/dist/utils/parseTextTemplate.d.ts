import { MergeUnionTypes } from "./mergeUnionTypes.js";
/**
 * Parses a text template into a map of parts and their prefixes and suffixes.
 * This parser assumes each part occurs exactly once in the template, and that all parts must occur in the order they are defined.
 * @example
 * ```typescript
 * const res = parseTextTemplate(
 *     "Hello, {{name}}! What is the {{thing}}?",
 *     [{
 *         key: "name",
 *         text: "{{name}}"
 *     }, {
 *         key: "thing",
 *         text: "{{thing}}"
 *     }]
 * );
 * expect(res).to.eql({
 *     name: {
 *         prefix: "Hello, ",
 *         suffix: "! What is the "
 *     },
 *     thing: {
 *         prefix: "What is the ",
 *         suffix: "?"
 *     }
 * });
 * ```
 * @example
 * ```typescript
 * const res2 = parseTextTemplate(
 *     "What is the {{thing}}?",
 *     [{
 *         key: "name",
 *         text: "{{name}}",
 *         optional: true
 *     }, {
 *         key: "thing",
 *         text: "{{thing}}"
 *     }]
 * );
 * expect(res2).to.eql({
 *     thing: {
 *         prefix: "What is the ",
 *         suffix: "?"
 *     }
 * });
 * ```
 */
export declare function parseTextTemplate<const Parts extends readonly TextTemplatePart[]>(template: string, parts: Parts): ParsedTextTemplate<Parts>;
type TextTemplatePart = {
    optional?: true | undefined;
    key: string;
    text: string;
};
type ParsedTextTemplate<Parts extends readonly TextTemplatePart[]> = MergeUnionTypes<{
    [Num in keyof Parts]: {
        [key in Parts[Num]["key"]]: Parts[Num]["optional"] extends true ? undefined | {
            prefix: string;
            suffix: string;
        } : {
            prefix: string;
            suffix: string;
        };
    };
}[number]>;
export {};
