/**
 * Anthropic OAuth flow (Claude Pro/Max)
 */
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";
/**
 * Login with Anthropic OAuth (device code flow)
 *
 * @param onAuthUrl - Callback to handle the authorization URL (e.g., open browser)
 * @param onPromptCode - Callback to prompt user for the authorization code
 */
export declare function loginAnthropic(onAuthUrl: (url: string) => void, onPromptCode: () => Promise<string>): Promise<OAuthCredentials>;
/**
 * Refresh Anthropic OAuth token
 */
export declare function refreshAnthropicToken(refreshToken: string): Promise<OAuthCredentials>;
export declare const anthropicOAuthProvider: OAuthProviderInterface;
//# sourceMappingURL=anthropic.d.ts.map