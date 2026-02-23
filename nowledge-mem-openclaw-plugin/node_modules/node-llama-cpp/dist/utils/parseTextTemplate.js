import { splitText } from "lifecycle-utils";
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
export function parseTextTemplate(template, parts) {
    const result = {};
    const templateParts = splitText(template, parts.map((part) => part.text));
    let partIndex = 0;
    for (let i = 0; i < templateParts.length; i++) {
        const textPart = templateParts[i];
        if (typeof textPart === "string")
            continue;
        for (; partIndex < parts.length; partIndex++) {
            const part = parts[partIndex];
            if (textPart.separator === part.text) {
                const previousItem = i > 0
                    ? templateParts[i - 1]
                    : null;
                const nextItem = i < templateParts.length - 1
                    ? templateParts[i + 1]
                    : null;
                result[part.key] = {
                    prefix: typeof previousItem === "string"
                        ? previousItem
                        : "",
                    suffix: typeof nextItem === "string"
                        ? nextItem
                        : ""
                };
                partIndex++;
                break;
            }
            if (part.optional != true) {
                if (result[part.key] != null)
                    throw new Error(`Template must contain exactly one "${part.text}"`);
                else if (partIndex > 0) {
                    const previousNonOptionalOrFoundPart = parts
                        .slice(0, partIndex)
                        .reverse()
                        .find((p) => (p.optional != true || result[p.key] != null));
                    if (previousNonOptionalOrFoundPart != null)
                        throw new Error(`Template must contain "${part.text}" after "${previousNonOptionalOrFoundPart.text}"`);
                    throw new Error(`Template must contain "${part.text}" at the beginning`);
                }
                else
                    throw new Error(`Template must contain "${part.text}" at the beginning`);
            }
            else
                result[part.key] = undefined;
        }
    }
    for (; partIndex < parts.length; partIndex++) {
        const part = parts[partIndex];
        if (part.optional == true) {
            result[part.key] = undefined;
            continue;
        }
        if (partIndex > 0) {
            const previousNonOptionalOrFoundPart = parts
                .slice(0, partIndex)
                .reverse()
                .find((p) => (p.optional != true || result[p.key] != null));
            if (previousNonOptionalOrFoundPart != null)
                throw new Error(`Template must contain "${part.text}" after "${previousNonOptionalOrFoundPart.text}"`);
            throw new Error(`Template must contain "${part.text}" at the beginning`);
        }
        else
            throw new Error(`Template must contain "${part.text}" at the beginning`);
    }
    return result;
}
//# sourceMappingURL=parseTextTemplate.js.map