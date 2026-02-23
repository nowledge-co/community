const apiProviderRegistry = new Map();
function wrapStream(api, stream) {
    return (model, context, options) => {
        if (model.api !== api) {
            throw new Error(`Mismatched api: ${model.api} expected ${api}`);
        }
        return stream(model, context, options);
    };
}
function wrapStreamSimple(api, streamSimple) {
    return (model, context, options) => {
        if (model.api !== api) {
            throw new Error(`Mismatched api: ${model.api} expected ${api}`);
        }
        return streamSimple(model, context, options);
    };
}
export function registerApiProvider(provider, sourceId) {
    apiProviderRegistry.set(provider.api, {
        provider: {
            api: provider.api,
            stream: wrapStream(provider.api, provider.stream),
            streamSimple: wrapStreamSimple(provider.api, provider.streamSimple),
        },
        sourceId,
    });
}
export function getApiProvider(api) {
    return apiProviderRegistry.get(api)?.provider;
}
export function getApiProviders() {
    return Array.from(apiProviderRegistry.values(), (entry) => entry.provider);
}
export function unregisterApiProviders(sourceId) {
    for (const [api, entry] of apiProviderRegistry.entries()) {
        if (entry.sourceId === sourceId) {
            apiProviderRegistry.delete(api);
        }
    }
}
export function clearApiProviders() {
    apiProviderRegistry.clear();
}
//# sourceMappingURL=api-registry.js.map