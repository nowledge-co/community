/**
 * Model registry - manages built-in and custom models, provides API key resolution.
 */
import { type Api, type AssistantMessageEventStream, type Context, type Model, type OAuthProviderInterface, type SimpleStreamOptions } from "@mariozechner/pi-ai";
import type { AuthStorage } from "./auth-storage.js";
import { clearConfigValueCache } from "./resolve-config-value.js";
/** Clear the config value command cache. Exported for testing. */
export declare const clearApiKeyCache: typeof clearConfigValueCache;
/**
 * Model registry - loads and manages models, resolves API keys via AuthStorage.
 */
export declare class ModelRegistry {
    readonly authStorage: AuthStorage;
    private modelsJsonPath;
    private models;
    private customProviderApiKeys;
    private registeredProviders;
    private loadError;
    constructor(authStorage: AuthStorage, modelsJsonPath?: string | undefined);
    /**
     * Reload models from disk (built-in + custom from models.json).
     */
    refresh(): void;
    /**
     * Get any error from loading models.json (undefined if no error).
     */
    getError(): string | undefined;
    private loadModels;
    /** Load built-in models and apply provider/model overrides */
    private loadBuiltInModels;
    /** Merge custom models into built-in list by provider+id (custom wins on conflicts). */
    private mergeCustomModels;
    private loadCustomModels;
    private validateConfig;
    private parseModels;
    /**
     * Get all models (built-in + custom).
     * If models.json had errors, returns only built-in models.
     */
    getAll(): Model<Api>[];
    /**
     * Get only models that have auth configured.
     * This is a fast check that doesn't refresh OAuth tokens.
     */
    getAvailable(): Model<Api>[];
    /**
     * Find a model by provider and ID.
     */
    find(provider: string, modelId: string): Model<Api> | undefined;
    /**
     * Get API key for a model.
     */
    getApiKey(model: Model<Api>): Promise<string | undefined>;
    /**
     * Get API key for a provider.
     */
    getApiKeyForProvider(provider: string): Promise<string | undefined>;
    /**
     * Check if a model is using OAuth credentials (subscription).
     */
    isUsingOAuth(model: Model<Api>): boolean;
    /**
     * Register a provider dynamically (from extensions).
     *
     * If provider has models: replaces all existing models for this provider.
     * If provider has only baseUrl/headers: overrides existing models' URLs.
     * If provider has oauth: registers OAuth provider for /login support.
     */
    registerProvider(providerName: string, config: ProviderConfigInput): void;
    private applyProviderConfig;
}
/**
 * Input type for registerProvider API.
 */
export interface ProviderConfigInput {
    baseUrl?: string;
    apiKey?: string;
    api?: Api;
    streamSimple?: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
    headers?: Record<string, string>;
    authHeader?: boolean;
    /** OAuth provider for /login support */
    oauth?: Omit<OAuthProviderInterface, "id">;
    models?: Array<{
        id: string;
        name: string;
        api?: Api;
        reasoning: boolean;
        input: ("text" | "image")[];
        cost: {
            input: number;
            output: number;
            cacheRead: number;
            cacheWrite: number;
        };
        contextWindow: number;
        maxTokens: number;
        headers?: Record<string, string>;
        compat?: Model<Api>["compat"];
    }>;
}
//# sourceMappingURL=model-registry.d.ts.map