/**
 * Antigravity OAuth flow (Gemini 3, Claude, GPT-OSS via Google Cloud)
 * Uses different OAuth credentials than google-gemini-cli for access to additional models.
 *
 * NOTE: This module uses Node.js http.createServer for the OAuth callback.
 * It is only intended for CLI use, not browser environments.
 */
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";
/**
 * Refresh Antigravity token
 */
export declare function refreshAntigravityToken(refreshToken: string, projectId: string): Promise<OAuthCredentials>;
/**
 * Login with Antigravity OAuth
 *
 * @param onAuth - Callback with URL and optional instructions
 * @param onProgress - Optional progress callback
 * @param onManualCodeInput - Optional promise that resolves with user-pasted redirect URL.
 *                            Races with browser callback - whichever completes first wins.
 */
export declare function loginAntigravity(onAuth: (info: {
    url: string;
    instructions?: string;
}) => void, onProgress?: (message: string) => void, onManualCodeInput?: () => Promise<string>): Promise<OAuthCredentials>;
export declare const antigravityOAuthProvider: OAuthProviderInterface;
//# sourceMappingURL=google-antigravity.d.ts.map