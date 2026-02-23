/**
 * OAuth credential management for AI providers.
 *
 * This module handles login, token refresh, and credential storage
 * for OAuth-based providers:
 * - Anthropic (Claude Pro/Max)
 * - GitHub Copilot
 * - Google Cloud Code Assist (Gemini CLI)
 * - Antigravity (Gemini 3, Claude, GPT-OSS via Google Cloud)
 */
import "../http-proxy.js";
export { anthropicOAuthProvider, loginAnthropic, refreshAnthropicToken } from "./anthropic.js";
export { getGitHubCopilotBaseUrl, githubCopilotOAuthProvider, loginGitHubCopilot, normalizeDomain, refreshGitHubCopilotToken, } from "./github-copilot.js";
export { antigravityOAuthProvider, loginAntigravity, refreshAntigravityToken } from "./google-antigravity.js";
export { geminiCliOAuthProvider, loginGeminiCli, refreshGoogleCloudToken } from "./google-gemini-cli.js";
export { loginOpenAICodex, openaiCodexOAuthProvider, refreshOpenAICodexToken } from "./openai-codex.js";
export * from "./types.js";
import type { OAuthCredentials, OAuthProviderId, OAuthProviderInfo, OAuthProviderInterface } from "./types.js";
/**
 * Get an OAuth provider by ID
 */
export declare function getOAuthProvider(id: OAuthProviderId): OAuthProviderInterface | undefined;
/**
 * Register a custom OAuth provider
 */
export declare function registerOAuthProvider(provider: OAuthProviderInterface): void;
/**
 * Get all registered OAuth providers
 */
export declare function getOAuthProviders(): OAuthProviderInterface[];
/**
 * @deprecated Use getOAuthProviders() which returns OAuthProviderInterface[]
 */
export declare function getOAuthProviderInfoList(): OAuthProviderInfo[];
/**
 * Refresh token for any OAuth provider.
 * @deprecated Use getOAuthProvider(id).refreshToken() instead
 */
export declare function refreshOAuthToken(providerId: OAuthProviderId, credentials: OAuthCredentials): Promise<OAuthCredentials>;
/**
 * Get API key for a provider from OAuth credentials.
 * Automatically refreshes expired tokens.
 *
 * @returns API key string and updated credentials, or null if no credentials
 * @throws Error if refresh fails
 */
export declare function getOAuthApiKey(providerId: OAuthProviderId, credentials: Record<string, OAuthCredentials>): Promise<{
    newCredentials: OAuthCredentials;
    apiKey: string;
} | null>;
//# sourceMappingURL=index.d.ts.map