import type { ImageContent } from "@mariozechner/pi-ai";
export interface ImageResizeOptions {
    maxWidth?: number;
    maxHeight?: number;
    maxBytes?: number;
    jpegQuality?: number;
}
export interface ResizedImage {
    data: string;
    mimeType: string;
    originalWidth: number;
    originalHeight: number;
    width: number;
    height: number;
    wasResized: boolean;
}
/**
 * Resize an image to fit within the specified max dimensions and file size.
 * Returns the original image if it already fits within the limits.
 *
 * Uses Photon (Rust/WASM) for image processing. If Photon is not available,
 * returns the original image unchanged.
 *
 * Strategy for staying under maxBytes:
 * 1. First resize to maxWidth/maxHeight
 * 2. Try both PNG and JPEG formats, pick the smaller one
 * 3. If still too large, try JPEG with decreasing quality
 * 4. If still too large, progressively reduce dimensions
 */
export declare function resizeImage(img: ImageContent, options?: ImageResizeOptions): Promise<ResizedImage>;
/**
 * Format a dimension note for resized images.
 * This helps the model understand the coordinate mapping.
 */
export declare function formatDimensionNote(result: ResizedImage): string | undefined;
//# sourceMappingURL=image-resize.d.ts.map