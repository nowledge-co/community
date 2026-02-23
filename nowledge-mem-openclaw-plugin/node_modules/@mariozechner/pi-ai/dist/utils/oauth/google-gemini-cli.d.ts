/**
 * Gemini CLI OAuth flow (Google Cloud Code Assist)
 * Standard Gemini models only (gemini-2.0-flash, gemini-2.5-*)
 *
 * NOTE: This module uses Node.js http.createServer for the OAuth callback.
 * It is only intended for CLI use, not browser environments.
 */
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";
/**
 * Refresh Google Cloud Code Assist token
 */
export declare function refreshGoogleCloudToken(refreshToken: string, projectId: string): Promise<OAuthCredentials>;
/**
 * Login with Gemini CLI (Google Cloud Code Assist) OAuth
 *
 * @param onAuth - Callback with URL and optional instructions
 * @param onProgress - Optional progress callback
 * @param onManualCodeInput - Optional promise that resolves with user-pasted redirect URL.
 *                            Races with browser callback - whichever completes first wins.
 */
export declare function loginGeminiCli(onAuth: (info: {
    url: string;
    instructions?: string;
}) => void, onProgress?: (message: string) => void, onManualCodeInput?: () => Promise<string>): Promise<OAuthCredentials>;
export declare const geminiCliOAuthProvider: OAuthProviderInterface;
//# sourceMappingURL=google-gemini-cli.d.ts.map