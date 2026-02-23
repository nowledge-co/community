import { GbnfJsonSchema } from "./types.js";
export declare function getGbnfGrammarForGbnfJsonSchema(schema: Readonly<GbnfJsonSchema>, { allowNewLines, scopePadSpaces }?: {
    allowNewLines?: boolean;
    scopePadSpaces?: number;
}): string;
