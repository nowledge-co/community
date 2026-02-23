/**
 * Tool HTML renderer for custom tools in HTML export.
 *
 * Renders custom tool calls and results to HTML by invoking their TUI renderers
 * and converting the ANSI output to HTML.
 */
import { ansiLinesToHtml } from "./ansi-to-html.js";
/**
 * Create a tool HTML renderer.
 *
 * The renderer looks up tool definitions and invokes their renderCall/renderResult
 * methods, converting the resulting TUI Component output (ANSI) to HTML.
 */
export function createToolHtmlRenderer(deps) {
    const { getToolDefinition, theme, width = 100 } = deps;
    return {
        renderCall(toolName, args) {
            try {
                const toolDef = getToolDefinition(toolName);
                if (!toolDef?.renderCall) {
                    return undefined;
                }
                const component = toolDef.renderCall(args, theme);
                const lines = component.render(width);
                return ansiLinesToHtml(lines);
            }
            catch {
                // On error, return undefined to trigger JSON fallback
                return undefined;
            }
        },
        renderResult(toolName, result, details, isError) {
            try {
                const toolDef = getToolDefinition(toolName);
                if (!toolDef?.renderResult) {
                    return undefined;
                }
                // Build AgentToolResult from content array
                // Cast content since session storage uses generic object types
                const agentToolResult = {
                    content: result,
                    details,
                    isError,
                };
                // Always render expanded, client-side will apply truncation
                const component = toolDef.renderResult(agentToolResult, { expanded: true, isPartial: false }, theme);
                const lines = component.render(width);
                return ansiLinesToHtml(lines);
            }
            catch {
                // On error, return undefined to trigger JSON fallback
                return undefined;
            }
        },
    };
}
//# sourceMappingURL=tool-renderer.js.map