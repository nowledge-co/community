import "./providers/register-builtins.js";
import "./utils/http-proxy.js";
import { getApiProvider } from "./api-registry.js";
export { getEnvApiKey } from "./env-api-keys.js";
function resolveApiProvider(api) {
    const provider = getApiProvider(api);
    if (!provider) {
        throw new Error(`No API provider registered for api: ${api}`);
    }
    return provider;
}
export function stream(model, context, options) {
    const provider = resolveApiProvider(model.api);
    return provider.stream(model, context, options);
}
export async function complete(model, context, options) {
    const s = stream(model, context, options);
    return s.result();
}
export function streamSimple(model, context, options) {
    const provider = resolveApiProvider(model.api);
    return provider.streamSimple(model, context, options);
}
export async function completeSimple(model, context, options) {
    const s = streamSimple(model, context, options);
    return s.result();
}
//# sourceMappingURL=stream.js.map