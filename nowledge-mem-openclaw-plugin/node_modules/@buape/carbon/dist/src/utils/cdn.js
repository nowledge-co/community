/**
 * Builds a Discord CDN URL with optional format and size parameters
 * @param baseUrl The base URL without extension or query parameters
 * @param hash The image hash (returns null if hash is null/undefined)
 * @param options Optional format and size parameters
 * @returns The complete CDN URL or null if hash is not provided
 */
export function buildCDNUrl(baseUrl, hash, options = {}) {
    if (!hash)
        return null;
    const format = options.format ?? "png";
    const url = `${baseUrl}/${hash}.${format}`;
    if (options.size) {
        return `${url}?size=${options.size}`;
    }
    return url;
}
//# sourceMappingURL=cdn.js.map