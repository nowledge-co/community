import { getCapabilities, getImageDimensions, imageFallback, renderImage, } from "../terminal-image.js";
export class Image {
    base64Data;
    mimeType;
    dimensions;
    theme;
    options;
    imageId;
    cachedLines;
    cachedWidth;
    constructor(base64Data, mimeType, theme, options = {}, dimensions) {
        this.base64Data = base64Data;
        this.mimeType = mimeType;
        this.theme = theme;
        this.options = options;
        this.dimensions = dimensions || getImageDimensions(base64Data, mimeType) || { widthPx: 800, heightPx: 600 };
        this.imageId = options.imageId;
    }
    /** Get the Kitty image ID used by this image (if any). */
    getImageId() {
        return this.imageId;
    }
    invalidate() {
        this.cachedLines = undefined;
        this.cachedWidth = undefined;
    }
    render(width) {
        if (this.cachedLines && this.cachedWidth === width) {
            return this.cachedLines;
        }
        const maxWidth = Math.min(width - 2, this.options.maxWidthCells ?? 60);
        const caps = getCapabilities();
        let lines;
        if (caps.images) {
            const result = renderImage(this.base64Data, this.dimensions, {
                maxWidthCells: maxWidth,
                imageId: this.imageId,
            });
            if (result) {
                // Store the image ID for later cleanup
                if (result.imageId) {
                    this.imageId = result.imageId;
                }
                // Return `rows` lines so TUI accounts for image height
                // First (rows-1) lines are empty (TUI clears them)
                // Last line: move cursor back up, then output image sequence
                lines = [];
                for (let i = 0; i < result.rows - 1; i++) {
                    lines.push("");
                }
                // Move cursor up to first row, then output image
                const moveUp = result.rows > 1 ? `\x1b[${result.rows - 1}A` : "";
                lines.push(moveUp + result.sequence);
            }
            else {
                const fallback = imageFallback(this.mimeType, this.dimensions, this.options.filename);
                lines = [this.theme.fallbackColor(fallback)];
            }
        }
        else {
            const fallback = imageFallback(this.mimeType, this.dimensions, this.options.filename);
            lines = [this.theme.fallbackColor(fallback)];
        }
        this.cachedLines = lines;
        this.cachedWidth = width;
        return lines;
    }
}
//# sourceMappingURL=image.js.map