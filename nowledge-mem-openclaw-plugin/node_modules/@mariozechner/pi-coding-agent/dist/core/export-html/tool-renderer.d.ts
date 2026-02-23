/**
 * Tool HTML renderer for custom tools in HTML export.
 *
 * Renders custom tool calls and results to HTML by invoking their TUI renderers
 * and converting the ANSI output to HTML.
 */
import type { Theme } from "../../modes/interactive/theme/theme.js";
import type { ToolDefinition } from "../extensions/types.js";
export interface ToolHtmlRendererDeps {
    /** Function to look up tool definition by name */
    getToolDefinition: (name: string) => ToolDefinition | undefined;
    /** Theme for styling */
    theme: Theme;
    /** Terminal width for rendering (default: 100) */
    width?: number;
}
export interface ToolHtmlRenderer {
    /** Render a tool call to HTML. Returns undefined if tool has no custom renderer. */
    renderCall(toolName: string, args: unknown): string | undefined;
    /** Render a tool result to HTML. Returns undefined if tool has no custom renderer. */
    renderResult(toolName: string, result: Array<{
        type: string;
        text?: string;
        data?: string;
        mimeType?: string;
    }>, details: unknown, isError: boolean): string | undefined;
}
/**
 * Create a tool HTML renderer.
 *
 * The renderer looks up tool definitions and invokes their renderCall/renderResult
 * methods, converting the resulting TUI Component output (ANSI) to HTML.
 */
export declare function createToolHtmlRenderer(deps: ToolHtmlRendererDeps): ToolHtmlRenderer;
//# sourceMappingURL=tool-renderer.d.ts.map