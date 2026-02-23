/**
 * Credential storage for API keys and OAuth tokens.
 * Handles loading, saving, and refreshing credentials from auth.json.
 *
 * Uses file locking to prevent race conditions when multiple pi instances
 * try to refresh tokens simultaneously.
 */
import { type OAuthCredentials, type OAuthLoginCallbacks, type OAuthProviderId } from "@mariozechner/pi-ai";
export type ApiKeyCredential = {
    type: "api_key";
    key: string;
};
export type OAuthCredential = {
    type: "oauth";
} & OAuthCredentials;
export type AuthCredential = ApiKeyCredential | OAuthCredential;
export type AuthStorageData = Record<string, AuthCredential>;
type LockResult<T> = {
    result: T;
    next?: string;
};
export interface AuthStorageBackend {
    withLock<T>(fn: (current: string | undefined) => LockResult<T>): T;
    withLockAsync<T>(fn: (current: string | undefined) => Promise<LockResult<T>>): Promise<T>;
}
export declare class FileAuthStorageBackend implements AuthStorageBackend {
    private authPath;
    constructor(authPath?: string);
    private ensureParentDir;
    private ensureFileExists;
    withLock<T>(fn: (current: string | undefined) => LockResult<T>): T;
    withLockAsync<T>(fn: (current: string | undefined) => Promise<LockResult<T>>): Promise<T>;
}
export declare class InMemoryAuthStorageBackend implements AuthStorageBackend {
    private value;
    withLock<T>(fn: (current: string | undefined) => LockResult<T>): T;
    withLockAsync<T>(fn: (current: string | undefined) => Promise<LockResult<T>>): Promise<T>;
}
/**
 * Credential storage backed by a JSON file.
 */
export declare class AuthStorage {
    private storage;
    private data;
    private runtimeOverrides;
    private fallbackResolver?;
    private loadError;
    private errors;
    private constructor();
    static create(authPath?: string): AuthStorage;
    static fromStorage(storage: AuthStorageBackend): AuthStorage;
    static inMemory(data?: AuthStorageData): AuthStorage;
    /**
     * Set a runtime API key override (not persisted to disk).
     * Used for CLI --api-key flag.
     */
    setRuntimeApiKey(provider: string, apiKey: string): void;
    /**
     * Remove a runtime API key override.
     */
    removeRuntimeApiKey(provider: string): void;
    /**
     * Set a fallback resolver for API keys not found in auth.json or env vars.
     * Used for custom provider keys from models.json.
     */
    setFallbackResolver(resolver: (provider: string) => string | undefined): void;
    private recordError;
    private parseStorageData;
    /**
     * Reload credentials from storage.
     */
    reload(): void;
    private persistProviderChange;
    /**
     * Get credential for a provider.
     */
    get(provider: string): AuthCredential | undefined;
    /**
     * Set credential for a provider.
     */
    set(provider: string, credential: AuthCredential): void;
    /**
     * Remove credential for a provider.
     */
    remove(provider: string): void;
    /**
     * List all providers with credentials.
     */
    list(): string[];
    /**
     * Check if credentials exist for a provider in auth.json.
     */
    has(provider: string): boolean;
    /**
     * Check if any form of auth is configured for a provider.
     * Unlike getApiKey(), this doesn't refresh OAuth tokens.
     */
    hasAuth(provider: string): boolean;
    /**
     * Get all credentials (for passing to getOAuthApiKey).
     */
    getAll(): AuthStorageData;
    drainErrors(): Error[];
    /**
     * Login to an OAuth provider.
     */
    login(providerId: OAuthProviderId, callbacks: OAuthLoginCallbacks): Promise<void>;
    /**
     * Logout from a provider.
     */
    logout(provider: string): void;
    private refreshOAuthTokenWithLock;
    /**
     * Get API key for a provider.
     * Priority:
     * 1. Runtime override (CLI --api-key)
     * 2. API key from auth.json
     * 3. OAuth token from auth.json (auto-refreshed with locking)
     * 4. Environment variable
     * 5. Fallback resolver (models.json custom providers)
     */
    getApiKey(providerId: string): Promise<string | undefined>;
    /**
     * Get all registered OAuth providers
     */
    getOAuthProviders(): import("@mariozechner/pi-ai").OAuthProviderInterface[];
}
export {};
//# sourceMappingURL=auth-storage.d.ts.map