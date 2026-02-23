import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static } from "@sinclair/typebox";
import { type TruncationResult } from "./truncate.js";
declare const lsSchema: import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export type LsToolInput = Static<typeof lsSchema>;
export interface LsToolDetails {
    truncation?: TruncationResult;
    entryLimitReached?: number;
}
/**
 * Pluggable operations for the ls tool.
 * Override these to delegate directory listing to remote systems (e.g., SSH).
 */
export interface LsOperations {
    /** Check if path exists */
    exists: (absolutePath: string) => Promise<boolean> | boolean;
    /** Get file/directory stats. Throws if not found. */
    stat: (absolutePath: string) => Promise<{
        isDirectory: () => boolean;
    }> | {
        isDirectory: () => boolean;
    };
    /** Read directory entries */
    readdir: (absolutePath: string) => Promise<string[]> | string[];
}
export interface LsToolOptions {
    /** Custom operations for directory listing. Default: local filesystem */
    operations?: LsOperations;
}
export declare function createLsTool(cwd: string, options?: LsToolOptions): AgentTool<typeof lsSchema>;
/** Default ls tool using process.cwd() - for backwards compatibility */
export declare const lsTool: AgentTool<import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>, any>;
export {};
//# sourceMappingURL=ls.d.ts.map