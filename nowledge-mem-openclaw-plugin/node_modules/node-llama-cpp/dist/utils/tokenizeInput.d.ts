import { Token, Tokenizer } from "../types.js";
import { LlamaText } from "./LlamaText.js";
export declare function tokenizeInput(input: Token | Token[] | string | LlamaText, tokenizer: Tokenizer, options?: "trimLeadingSpace", clone?: boolean): Token[];
