export declare const grammarNoValue = "\"\"";
export declare const reservedRuleNames: {
    readonly null: "null-rule";
    readonly boolean: "boolean-rule";
    readonly number: {
        readonly fractional: "fractional-number-rule";
        readonly integer: "integer-number-rule";
    };
    readonly stringChar: "string-char-rule";
    readonly string: ({ minLength, maxLength }: {
        minLength: number;
        maxLength?: number;
    }) => string;
    readonly formatString: (format: string) => string;
    readonly whitespace: ({ newLine, nestingScope, scopeSpaces }: {
        newLine?: "before" | "after" | false;
        nestingScope: number;
        scopeSpaces: number;
    }) => string;
    readonly commaWhitespace: ({ newLine, nestingScope, scopeSpaces }: {
        newLine?: "before" | "after" | false;
        nestingScope: number;
        scopeSpaces: number;
    }) => string;
    readonly anyJson: ({ allowNewLines, nestingScope, scopeSpaces }: {
        allowNewLines: boolean;
        nestingScope: number;
        scopeSpaces: number;
    }) => string;
};
