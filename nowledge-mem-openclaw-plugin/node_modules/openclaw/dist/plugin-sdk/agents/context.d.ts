type ModelEntry = {
    id: string;
    contextWindow?: number;
};
type ConfigModelEntry = {
    id?: string;
    contextWindow?: number;
};
type ProviderConfigEntry = {
    models?: ConfigModelEntry[];
};
type ModelsConfig = {
    providers?: Record<string, ProviderConfigEntry | undefined>;
};
export declare function applyDiscoveredContextWindows(params: {
    cache: Map<string, number>;
    models: ModelEntry[];
}): void;
export declare function applyConfiguredContextWindows(params: {
    cache: Map<string, number>;
    modelsConfig: ModelsConfig | undefined;
}): void;
export declare function lookupContextTokens(modelId?: string): number | undefined;
export {};
