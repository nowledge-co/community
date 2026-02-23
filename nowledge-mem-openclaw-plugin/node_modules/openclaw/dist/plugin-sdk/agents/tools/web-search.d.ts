import type { OpenClawConfig } from "../../config/config.js";
import type { AnyAgentTool } from "./common.js";
type PerplexityConfig = {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
};
type PerplexityApiKeySource = "config" | "perplexity_env" | "openrouter_env" | "none";
type GrokConfig = {
    apiKey?: string;
    model?: string;
    inlineCitations?: boolean;
};
type GrokSearchResponse = {
    output?: Array<{
        type?: string;
        role?: string;
        text?: string;
        content?: Array<{
            type?: string;
            text?: string;
            annotations?: Array<{
                type?: string;
                url?: string;
                start_index?: number;
                end_index?: number;
            }>;
        }>;
        annotations?: Array<{
            type?: string;
            url?: string;
            start_index?: number;
            end_index?: number;
        }>;
    }>;
    output_text?: string;
    citations?: string[];
    inline_citations?: Array<{
        start_index: number;
        end_index: number;
        url: string;
    }>;
};
type PerplexityBaseUrlHint = "direct" | "openrouter";
declare function extractGrokContent(data: GrokSearchResponse): {
    text: string | undefined;
    annotationCitations: string[];
};
declare function inferPerplexityBaseUrlFromApiKey(apiKey?: string): PerplexityBaseUrlHint | undefined;
declare function resolvePerplexityBaseUrl(perplexity?: PerplexityConfig, apiKeySource?: PerplexityApiKeySource, apiKey?: string): string;
declare function isDirectPerplexityBaseUrl(baseUrl: string): boolean;
declare function resolvePerplexityRequestModel(baseUrl: string, model: string): string;
declare function resolveGrokApiKey(grok?: GrokConfig): string | undefined;
declare function resolveGrokModel(grok?: GrokConfig): string;
declare function resolveGrokInlineCitations(grok?: GrokConfig): boolean;
declare function normalizeFreshness(value: string | undefined): string | undefined;
/**
 * Map normalized freshness values (pd/pw/pm/py) to Perplexity's
 * search_recency_filter values (day/week/month/year).
 */
declare function freshnessToPerplexityRecency(freshness: string | undefined): string | undefined;
export declare function createWebSearchTool(options?: {
    config?: OpenClawConfig;
    sandboxed?: boolean;
}): AnyAgentTool | null;
export declare const __testing: {
    readonly inferPerplexityBaseUrlFromApiKey: typeof inferPerplexityBaseUrlFromApiKey;
    readonly resolvePerplexityBaseUrl: typeof resolvePerplexityBaseUrl;
    readonly isDirectPerplexityBaseUrl: typeof isDirectPerplexityBaseUrl;
    readonly resolvePerplexityRequestModel: typeof resolvePerplexityRequestModel;
    readonly normalizeFreshness: typeof normalizeFreshness;
    readonly freshnessToPerplexityRecency: typeof freshnessToPerplexityRecency;
    readonly resolveGrokApiKey: typeof resolveGrokApiKey;
    readonly resolveGrokModel: typeof resolveGrokModel;
    readonly resolveGrokInlineCitations: typeof resolveGrokInlineCitations;
    readonly extractGrokContent: typeof extractGrokContent;
};
export {};
