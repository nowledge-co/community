import type { SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
export interface OpenAICodexResponsesOptions extends StreamOptions {
    reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh";
    reasoningSummary?: "auto" | "concise" | "detailed" | "off" | "on" | null;
    textVerbosity?: "low" | "medium" | "high";
}
export declare const streamOpenAICodexResponses: StreamFunction<"openai-codex-responses", OpenAICodexResponsesOptions>;
export declare const streamSimpleOpenAICodexResponses: StreamFunction<"openai-codex-responses", SimpleStreamOptions>;
//# sourceMappingURL=openai-codex-responses.d.ts.map