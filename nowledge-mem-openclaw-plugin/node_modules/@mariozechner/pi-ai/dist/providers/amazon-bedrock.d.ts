import type { SimpleStreamOptions, StreamFunction, StreamOptions, ThinkingBudgets, ThinkingLevel } from "../types.js";
export interface BedrockOptions extends StreamOptions {
    region?: string;
    profile?: string;
    toolChoice?: "auto" | "any" | "none" | {
        type: "tool";
        name: string;
    };
    reasoning?: ThinkingLevel;
    thinkingBudgets?: ThinkingBudgets;
    interleavedThinking?: boolean;
}
export declare const streamBedrock: StreamFunction<"bedrock-converse-stream", BedrockOptions>;
export declare const streamSimpleBedrock: StreamFunction<"bedrock-converse-stream", SimpleStreamOptions>;
//# sourceMappingURL=amazon-bedrock.d.ts.map