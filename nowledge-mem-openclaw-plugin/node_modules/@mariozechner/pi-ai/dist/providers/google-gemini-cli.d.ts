/**
 * Google Gemini CLI / Antigravity provider.
 * Shared implementation for both google-gemini-cli and google-antigravity providers.
 * Uses the Cloud Code Assist API endpoint to access Gemini and Claude models.
 */
import type { Content, ThinkingConfig } from "@google/genai";
import type { Context, Model, SimpleStreamOptions, StreamFunction, StreamOptions } from "../types.js";
import { convertTools, mapToolChoice } from "./google-shared.js";
/**
 * Thinking level for Gemini 3 models.
 * Mirrors Google's ThinkingLevel enum values.
 */
export type GoogleThinkingLevel = "THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";
export interface GoogleGeminiCliOptions extends StreamOptions {
    toolChoice?: "auto" | "none" | "any";
    /**
     * Thinking/reasoning configuration.
     * - Gemini 2.x models: use `budgetTokens` to set the thinking budget
     * - Gemini 3 models (gemini-3-pro-*, gemini-3-flash-*): use `level` instead
     *
     * When using `streamSimple`, this is handled automatically based on the model.
     */
    thinking?: {
        enabled: boolean;
        /** Thinking budget in tokens. Use for Gemini 2.x models. */
        budgetTokens?: number;
        /** Thinking level. Use for Gemini 3 models (LOW/HIGH for Pro, MINIMAL/LOW/MEDIUM/HIGH for Flash). */
        level?: GoogleThinkingLevel;
    };
    projectId?: string;
}
/**
 * Extract retry delay from Gemini error response (in milliseconds).
 * Checks headers first (Retry-After, x-ratelimit-reset, x-ratelimit-reset-after),
 * then parses body patterns like:
 * - "Your quota will reset after 39s"
 * - "Your quota will reset after 18h31m10s"
 * - "Please retry in Xs" or "Please retry in Xms"
 * - "retryDelay": "34.074824224s" (JSON field)
 */
export declare function extractRetryDelay(errorText: string, response?: Response | Headers): number | undefined;
interface CloudCodeAssistRequest {
    project: string;
    model: string;
    request: {
        contents: Content[];
        sessionId?: string;
        systemInstruction?: {
            role?: string;
            parts: {
                text: string;
            }[];
        };
        generationConfig?: {
            maxOutputTokens?: number;
            temperature?: number;
            thinkingConfig?: ThinkingConfig;
        };
        tools?: ReturnType<typeof convertTools>;
        toolConfig?: {
            functionCallingConfig: {
                mode: ReturnType<typeof mapToolChoice>;
            };
        };
    };
    requestType?: string;
    userAgent?: string;
    requestId?: string;
}
export declare const streamGoogleGeminiCli: StreamFunction<"google-gemini-cli", GoogleGeminiCliOptions>;
export declare const streamSimpleGoogleGeminiCli: StreamFunction<"google-gemini-cli", SimpleStreamOptions>;
export declare function buildRequest(model: Model<"google-gemini-cli">, context: Context, projectId: string, options?: GoogleGeminiCliOptions, isAntigravity?: boolean): CloudCodeAssistRequest;
export {};
//# sourceMappingURL=google-gemini-cli.d.ts.map