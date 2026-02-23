import type { KnownProvider } from "./types.js";
/**
 * Get API key for provider from known environment variables, e.g. OPENAI_API_KEY.
 *
 * Will not return API keys for providers that require OAuth tokens.
 */
export declare function getEnvApiKey(provider: KnownProvider): string | undefined;
export declare function getEnvApiKey(provider: string): string | undefined;
//# sourceMappingURL=env-api-keys.d.ts.map