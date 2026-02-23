/**
 * GitHub Copilot OAuth flow
 */
import type { OAuthCredentials, OAuthProviderInterface } from "./types.js";
export declare function normalizeDomain(input: string): string | null;
export declare function getGitHubCopilotBaseUrl(token?: string, enterpriseDomain?: string): string;
/**
 * Refresh GitHub Copilot token
 */
export declare function refreshGitHubCopilotToken(refreshToken: string, enterpriseDomain?: string): Promise<OAuthCredentials>;
/**
 * Login with GitHub Copilot OAuth (device code flow)
 *
 * @param options.onAuth - Callback with URL and optional instructions (user code)
 * @param options.onPrompt - Callback to prompt user for input
 * @param options.onProgress - Optional progress callback
 * @param options.signal - Optional AbortSignal for cancellation
 */
export declare function loginGitHubCopilot(options: {
    onAuth: (url: string, instructions?: string) => void;
    onPrompt: (prompt: {
        message: string;
        placeholder?: string;
        allowEmpty?: boolean;
    }) => Promise<string>;
    onProgress?: (message: string) => void;
    signal?: AbortSignal;
}): Promise<OAuthCredentials>;
export declare const githubCopilotOAuthProvider: OAuthProviderInterface;
//# sourceMappingURL=github-copilot.d.ts.map