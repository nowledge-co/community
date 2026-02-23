import { Container, type TUI } from "@mariozechner/pi-tui";
import type { ToolDefinition } from "../../../core/extensions/types.js";
export interface ToolExecutionOptions {
    showImages?: boolean;
}
/**
 * Component that renders a tool call with its result (updateable)
 */
export declare class ToolExecutionComponent extends Container {
    private contentBox;
    private contentText;
    private imageComponents;
    private imageSpacers;
    private toolName;
    private args;
    private expanded;
    private showImages;
    private isPartial;
    private toolDefinition?;
    private ui;
    private cwd;
    private result?;
    private editDiffPreview?;
    private editDiffArgsKey?;
    private convertedImages;
    constructor(toolName: string, args: any, options: ToolExecutionOptions | undefined, toolDefinition: ToolDefinition | undefined, ui: TUI, cwd?: string);
    /**
     * Check if we should use built-in rendering for this tool.
     * Returns true if the tool name is a built-in AND either there's no toolDefinition
     * or the toolDefinition doesn't provide custom renderers.
     */
    private shouldUseBuiltInRenderer;
    updateArgs(args: any): void;
    /**
     * Signal that args are complete (tool is about to execute).
     * This triggers diff computation for edit tool.
     */
    setArgsComplete(): void;
    /**
     * Compute edit diff preview when we have complete args.
     * This runs async and updates display when done.
     */
    private maybeComputeEditDiff;
    updateResult(result: {
        content: Array<{
            type: string;
            text?: string;
            data?: string;
            mimeType?: string;
        }>;
        details?: any;
        isError: boolean;
    }, isPartial?: boolean): void;
    /**
     * Convert non-PNG images to PNG for Kitty graphics protocol.
     * Kitty requires PNG format (f=100), so JPEG/GIF/WebP won't display.
     */
    private maybeConvertImagesForKitty;
    setExpanded(expanded: boolean): void;
    setShowImages(show: boolean): void;
    invalidate(): void;
    private updateDisplay;
    /**
     * Render bash content using visual line truncation (like bash-execution.ts)
     */
    private renderBashContent;
    private getTextOutput;
    private formatToolExecution;
}
//# sourceMappingURL=tool-execution.d.ts.map