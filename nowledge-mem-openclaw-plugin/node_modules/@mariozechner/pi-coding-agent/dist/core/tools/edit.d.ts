import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static } from "@sinclair/typebox";
declare const editSchema: import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TString;
    oldText: import("@sinclair/typebox").TString;
    newText: import("@sinclair/typebox").TString;
}>;
export type EditToolInput = Static<typeof editSchema>;
export interface EditToolDetails {
    /** Unified diff of the changes made */
    diff: string;
    /** Line number of the first change in the new file (for editor navigation) */
    firstChangedLine?: number;
}
/**
 * Pluggable operations for the edit tool.
 * Override these to delegate file editing to remote systems (e.g., SSH).
 */
export interface EditOperations {
    /** Read file contents as a Buffer */
    readFile: (absolutePath: string) => Promise<Buffer>;
    /** Write content to a file */
    writeFile: (absolutePath: string, content: string) => Promise<void>;
    /** Check if file is readable and writable (throw if not) */
    access: (absolutePath: string) => Promise<void>;
}
export interface EditToolOptions {
    /** Custom operations for file editing. Default: local filesystem */
    operations?: EditOperations;
}
export declare function createEditTool(cwd: string, options?: EditToolOptions): AgentTool<typeof editSchema>;
/** Default edit tool using process.cwd() - for backwards compatibility */
export declare const editTool: AgentTool<import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TString;
    oldText: import("@sinclair/typebox").TString;
    newText: import("@sinclair/typebox").TString;
}>, any>;
export {};
//# sourceMappingURL=edit.d.ts.map