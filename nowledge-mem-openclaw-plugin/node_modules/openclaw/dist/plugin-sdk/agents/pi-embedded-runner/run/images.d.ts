import type { ImageContent } from "@mariozechner/pi-ai";
import type { SandboxFsBridge } from "../../sandbox/fs-bridge.js";
/**
 * Result of detecting an image reference in text.
 */
export interface DetectedImageRef {
    /** The raw matched string from the prompt */
    raw: string;
    /** The type of reference (path or url) */
    type: "path" | "url";
    /** The resolved/normalized path or URL */
    resolved: string;
    /** Index of the message this ref was found in (for history images) */
    messageIndex?: number;
}
/**
 * Detects image references in a user prompt.
 *
 * Patterns detected:
 * - Absolute paths: /path/to/image.png
 * - Relative paths: ./image.png, ../images/photo.jpg
 * - Home paths: ~/Pictures/screenshot.png
 * - file:// URLs: file:///path/to/image.png
 * - Message attachments: [Image: source: /path/to/image.jpg]
 *
 * @param prompt The user prompt text to scan
 * @returns Array of detected image references
 */
export declare function detectImageReferences(prompt: string): DetectedImageRef[];
/**
 * Loads an image from a file path or URL and returns it as ImageContent.
 *
 * @param ref The detected image reference
 * @param workspaceDir The current workspace directory for resolving relative paths
 * @param options Optional settings for sandbox and size limits
 * @returns The loaded image content, or null if loading failed
 */
export declare function loadImageFromRef(ref: DetectedImageRef, workspaceDir: string, options?: {
    maxBytes?: number;
    sandbox?: {
        root: string;
        bridge: SandboxFsBridge;
    };
}): Promise<ImageContent | null>;
/**
 * Checks if a model supports image input based on its input capabilities.
 *
 * @param model The model object with input capability array
 * @returns True if the model supports image input
 */
export declare function modelSupportsImages(model: {
    input?: string[];
}): boolean;
/**
 * Detects and loads images referenced in a prompt for models with vision capability.
 *
 * This function scans the prompt for image references (file paths and URLs),
 * loads them, and returns them as ImageContent array ready to be passed to
 * the model's prompt method.
 *
 * Also scans conversation history for images from previous turns and returns
 * them mapped by message index so they can be injected at their original location.
 *
 * @param params Configuration for image detection and loading
 * @returns Object with loaded images for current prompt and history images by message index
 */
export declare function detectAndLoadPromptImages(params: {
    prompt: string;
    workspaceDir: string;
    model: {
        input?: string[];
    };
    existingImages?: ImageContent[];
    historyMessages?: unknown[];
    maxBytes?: number;
    maxDimensionPx?: number;
    sandbox?: {
        root: string;
        bridge: SandboxFsBridge;
    };
}): Promise<{
    /** Images for the current prompt (existingImages + detected in current prompt) */
    images: ImageContent[];
    /** Images from history messages, keyed by message index */
    historyImagesByIndex: Map<number, ImageContent[]>;
    detectedRefs: DetectedImageRef[];
    loadedCount: number;
    skippedCount: number;
}>;
