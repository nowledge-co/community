/**
 * Supported image formats for Discord CDN URLs
 */
export type ImageFormat = "png" | "jpg" | "jpeg" | "webp" | "gif";
/**
 * Valid image sizes for Discord CDN URLs (powers of 2 between 16 and 4096)
 */
export type ImageSize = 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096;
/**
 * Options for building CDN URLs
 */
export interface CDNUrlOptions {
    /**
     * The image format to use
     * @default "png"
     */
    format?: ImageFormat;
    /**
     * The image size to use (must be a power of 2 between 16 and 4096)
     */
    size?: ImageSize;
}
/**
 * Builds a Discord CDN URL with optional format and size parameters
 * @param baseUrl The base URL without extension or query parameters
 * @param hash The image hash (returns null if hash is null/undefined)
 * @param options Optional format and size parameters
 * @returns The complete CDN URL or null if hash is not provided
 */
export declare function buildCDNUrl(baseUrl: string, hash: string | null | undefined, options?: CDNUrlOptions): string | null;
//# sourceMappingURL=cdn.d.ts.map