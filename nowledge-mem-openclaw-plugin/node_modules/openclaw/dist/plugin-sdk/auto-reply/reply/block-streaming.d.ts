import type { OpenClawConfig } from "../../config/config.js";
export type BlockStreamingCoalescing = {
    minChars: number;
    maxChars: number;
    idleMs: number;
    joiner: string;
    /** When true, the coalescer flushes the buffer on each enqueue (paragraph-boundary flush). */
    flushOnEnqueue?: boolean;
};
export declare function resolveBlockStreamingChunking(cfg: OpenClawConfig | undefined, provider?: string, accountId?: string | null): {
    minChars: number;
    maxChars: number;
    breakPreference: "paragraph" | "newline" | "sentence";
    flushOnParagraph?: boolean;
};
export declare function resolveBlockStreamingCoalescing(cfg: OpenClawConfig | undefined, provider?: string, accountId?: string | null, chunking?: {
    minChars: number;
    maxChars: number;
    breakPreference: "paragraph" | "newline" | "sentence";
}, opts?: {
    chunkMode?: "length" | "newline";
}): BlockStreamingCoalescing | undefined;
