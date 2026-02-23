import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static } from "@sinclair/typebox";
declare const writeSchema: import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TString;
    content: import("@sinclair/typebox").TString;
}>;
export type WriteToolInput = Static<typeof writeSchema>;
/**
 * Pluggable operations for the write tool.
 * Override these to delegate file writing to remote systems (e.g., SSH).
 */
export interface WriteOperations {
    /** Write content to a file */
    writeFile: (absolutePath: string, content: string) => Promise<void>;
    /** Create directory (recursively) */
    mkdir: (dir: string) => Promise<void>;
}
export interface WriteToolOptions {
    /** Custom operations for file writing. Default: local filesystem */
    operations?: WriteOperations;
}
export declare function createWriteTool(cwd: string, options?: WriteToolOptions): AgentTool<typeof writeSchema>;
/** Default write tool using process.cwd() - for backwards compatibility */
export declare const writeTool: AgentTool<import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TString;
    content: import("@sinclair/typebox").TString;
}>, any>;
export {};
//# sourceMappingURL=write.d.ts.map