import { LlamaText } from "./LlamaText.js";
/**
 * Truncate the given text starting from the specified index and try to round to the nearest word.
 * @param text - The text to truncate and round
 * @param truncateSize - The size of the text to truncate
 * @param maxRound - The maximum number of extra characters to delete to round to the nearest word
 * @param truncateStart - Whether to truncate from the start of the text. If false, truncate from the end.
 * @returns - The truncated and rounded text
 */
export declare function truncateTextAndRoundToWords(text: string, truncateSize: number, maxRound?: number, truncateStart?: boolean): string;
export declare function truncateLlamaTextAndRoundToWords(llamaText: LlamaText, truncateSize: number, maxRound?: number, truncateStart?: boolean): LlamaText;
