import path from "path";
import { normalizeGgufDownloadUrl } from "../gguf/utils/normalizeGgufDownloadUrl.js";
import { parseModelUri, resolveParsedModelUri, getAuthorizationHeader } from "./parseModelUri.js";
import { isUrl } from "./isUrl.js";
export function resolveModelDestination(modelDestination, convertUrlToUri = false, endpoints) {
    const parsedUri = parseModelUri(modelDestination, convertUrlToUri, endpoints);
    if (parsedUri != null) {
        return {
            type: "uri",
            url: parsedUri.type === "resolved"
                ? parsedUri.resolvedUrl
                : undefined,
            uri: parsedUri.uri,
            parsedUri
        };
    }
    else if (isUrl(modelDestination)) {
        return {
            type: "url",
            url: normalizeGgufDownloadUrl(modelDestination, endpoints)
        };
    }
    try {
        return {
            type: "file",
            path: path.resolve(process.cwd(), modelDestination)
        };
    }
    catch (err) {
        throw new Error(`Invalid path: ${modelDestination}`);
    }
}
export async function resolveModelArgToFilePathOrUrl(modelDestination, optionHeaders) {
    const resolvedModelDestination = resolveModelDestination(modelDestination);
    if (resolvedModelDestination.type == "file")
        return [resolvedModelDestination, resolvedModelDestination.path];
    else if (resolvedModelDestination.type === "url")
        return [resolvedModelDestination, resolvedModelDestination.url];
    else if (resolvedModelDestination.parsedUri.type === "resolved")
        return [resolvedModelDestination, resolvedModelDestination.parsedUri.resolvedUrl];
    const resolvedModelUri = await resolveParsedModelUri(resolvedModelDestination.parsedUri, {
        authorizationHeader: getAuthorizationHeader(optionHeaders)
    });
    return [
        {
            type: "uri",
            url: resolvedModelUri.resolvedUrl,
            uri: resolvedModelUri.uri,
            parsedUri: resolvedModelUri
        },
        resolvedModelUri.resolvedUrl
    ];
}
//# sourceMappingURL=resolveModelDestination.js.map