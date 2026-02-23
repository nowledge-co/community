import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
export type AnthropicEffort = "low" | "medium" | "high" | "max";
export interface AnthropicOptions extends StreamOptions {
    /**
     * Enable extended thinking.
     * For Opus 4.6+: uses adaptive thinking (Claude decides when/how much to think).
     * For older models: uses budget-based thinking with thinkingBudgetTokens.
     */
    thinkingEnabled?: boolean;
    /**
     * Token budget for extended thinking (older models only).
     * Ignored for Opus 4.6+ which uses adaptive thinking.
     */
    thinkingBudgetTokens?: number;
    /**
     * Effort level for adaptive thinking (Opus 4.6+ only).
     * Controls how much thinking Claude allocates:
     * - "max": Always thinks with no constraints
     * - "high": Always thinks, deep reasoning (default)
     * - "medium": Moderate thinking, may skip for simple queries
     * - "low": Minimal thinking, skips for simple tasks
     * Ignored for older models.
     */
    effort?: AnthropicEffort;
    interleavedThinking?: boolean;
    toolChoice?: "auto" | "any" | "none" | {
        type: "tool";
        name: string;
    };
}
export declare const streamAnthropic: StreamFunction<"anthropic-messages", AnthropicOptions>;
export declare const streamSimpleAnthropic: StreamFunction<"anthropic-messages", SimpleStreamOptions>;
//# sourceMappingURL=anthropic.d.ts.map