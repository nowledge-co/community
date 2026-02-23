export { type BashOperations, type BashSpawnContext, type BashSpawnHook, type BashToolDetails, type BashToolInput, type BashToolOptions, bashTool, createBashTool, } from "./bash.js";
export { createEditTool, type EditOperations, type EditToolDetails, type EditToolInput, type EditToolOptions, editTool, } from "./edit.js";
export { createFindTool, type FindOperations, type FindToolDetails, type FindToolInput, type FindToolOptions, findTool, } from "./find.js";
export { createGrepTool, type GrepOperations, type GrepToolDetails, type GrepToolInput, type GrepToolOptions, grepTool, } from "./grep.js";
export { createLsTool, type LsOperations, type LsToolDetails, type LsToolInput, type LsToolOptions, lsTool, } from "./ls.js";
export { createReadTool, type ReadOperations, type ReadToolDetails, type ReadToolInput, type ReadToolOptions, readTool, } from "./read.js";
export { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, type TruncationOptions, type TruncationResult, truncateHead, truncateLine, truncateTail, } from "./truncate.js";
export { createWriteTool, type WriteOperations, type WriteToolInput, type WriteToolOptions, writeTool, } from "./write.js";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type BashToolOptions } from "./bash.js";
import { type ReadToolOptions } from "./read.js";
/** Tool type (AgentTool from pi-ai) */
export type Tool = AgentTool<any>;
export declare const codingTools: Tool[];
export declare const readOnlyTools: Tool[];
export declare const allTools: {
    read: AgentTool<import("@sinclair/typebox").TObject<{
        path: import("@sinclair/typebox").TString;
        offset: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>, any>;
    bash: AgentTool<import("@sinclair/typebox").TObject<{
        command: import("@sinclair/typebox").TString;
        timeout: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>, any>;
    edit: AgentTool<import("@sinclair/typebox").TObject<{
        path: import("@sinclair/typebox").TString;
        oldText: import("@sinclair/typebox").TString;
        newText: import("@sinclair/typebox").TString;
    }>, any>;
    write: AgentTool<import("@sinclair/typebox").TObject<{
        path: import("@sinclair/typebox").TString;
        content: import("@sinclair/typebox").TString;
    }>, any>;
    grep: AgentTool<import("@sinclair/typebox").TObject<{
        pattern: import("@sinclair/typebox").TString;
        path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        glob: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        ignoreCase: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
        literal: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
        context: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>, any>;
    find: AgentTool<import("@sinclair/typebox").TObject<{
        pattern: import("@sinclair/typebox").TString;
        path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>, any>;
    ls: AgentTool<import("@sinclair/typebox").TObject<{
        path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
        limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    }>, any>;
};
export type ToolName = keyof typeof allTools;
export interface ToolsOptions {
    /** Options for the read tool */
    read?: ReadToolOptions;
    /** Options for the bash tool */
    bash?: BashToolOptions;
}
/**
 * Create coding tools configured for a specific working directory.
 */
export declare function createCodingTools(cwd: string, options?: ToolsOptions): Tool[];
/**
 * Create read-only tools configured for a specific working directory.
 */
export declare function createReadOnlyTools(cwd: string, options?: ToolsOptions): Tool[];
/**
 * Create all tools configured for a specific working directory.
 */
export declare function createAllTools(cwd: string, options?: ToolsOptions): Record<ToolName, Tool>;
//# sourceMappingURL=index.d.ts.map