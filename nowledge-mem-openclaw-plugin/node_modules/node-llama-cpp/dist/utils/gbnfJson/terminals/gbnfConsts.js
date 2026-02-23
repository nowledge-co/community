export const grammarNoValue = '""';
export const reservedRuleNames = {
    null: "null-rule",
    boolean: "boolean-rule",
    number: {
        fractional: "fractional-number-rule",
        integer: "integer-number-rule"
    },
    stringChar: "string-char-rule",
    string({ minLength, maxLength }) {
        if (minLength === 0 && maxLength == null)
            return "string-rule";
        else if (maxLength == null)
            return [
                "string-",
                minLength,
                "-rule"
            ].join("");
        return [
            "string-",
            minLength,
            "-",
            maxLength,
            "-rule"
        ].join("");
    },
    formatString(format) {
        return "string-format-" + format + "-rule";
    },
    whitespace({ newLine, nestingScope, scopeSpaces }) {
        if (!newLine)
            return "whitespace-no-new-lines-rule";
        return [
            "whitespace-",
            newLine === "before"
                ? "b"
                : newLine === "after"
                    ? "a"
                    : "n",
            "-" + nestingScope,
            "-" + scopeSpaces,
            "-rule"
        ].join("");
    },
    commaWhitespace({ newLine, nestingScope, scopeSpaces }) {
        if (!newLine)
            return "comma-whitespace-no-new-lines-rule";
        return [
            "comma-whitespace-",
            newLine === "before"
                ? "b"
                : newLine === "after"
                    ? "a"
                    : "n",
            "-" + nestingScope,
            "-" + scopeSpaces,
            "-rule"
        ].join("");
    },
    anyJson({ allowNewLines, nestingScope, scopeSpaces }) {
        return [
            "any-json-",
            !allowNewLines
                ? "s-"
                : "",
            nestingScope,
            "-" + scopeSpaces,
            "-rule"
        ].join("");
    }
};
//# sourceMappingURL=gbnfConsts.js.map