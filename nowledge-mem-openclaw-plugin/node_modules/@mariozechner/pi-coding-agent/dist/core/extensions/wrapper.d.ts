/**
 * Tool wrappers for extensions.
 */
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ExtensionRunner } from "./runner.js";
import type { RegisteredTool } from "./types.js";
/**
 * Wrap a RegisteredTool into an AgentTool.
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 */
export declare function wrapRegisteredTool(registeredTool: RegisteredTool, runner: ExtensionRunner): AgentTool;
/**
 * Wrap all registered tools into AgentTools.
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 */
export declare function wrapRegisteredTools(registeredTools: RegisteredTool[], runner: ExtensionRunner): AgentTool[];
/**
 * Wrap a tool with extension callbacks for interception.
 * - Emits tool_call event before execution (can block)
 * - Emits tool_result event after execution (can modify result)
 */
export declare function wrapToolWithExtensions<T>(tool: AgentTool<any, T>, runner: ExtensionRunner): AgentTool<any, T>;
/**
 * Wrap all tools with extension callbacks.
 */
export declare function wrapToolsWithExtensions<T>(tools: AgentTool<any, T>[], runner: ExtensionRunner): AgentTool<any, T>[];
//# sourceMappingURL=wrapper.d.ts.map