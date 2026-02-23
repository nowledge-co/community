import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static } from "@sinclair/typebox";
import { type TruncationResult } from "./truncate.js";
declare const grepSchema: import("@sinclair/typebox").TObject<{
    pattern: import("@sinclair/typebox").TString;
    path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    glob: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    ignoreCase: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    literal: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    context: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export type GrepToolInput = Static<typeof grepSchema>;
export interface GrepToolDetails {
    truncation?: TruncationResult;
    matchLimitReached?: number;
    linesTruncated?: boolean;
}
/**
 * Pluggable operations for the grep tool.
 * Override these to delegate search to remote systems (e.g., SSH).
 */
export interface GrepOperations {
    /** Check if path is a directory. Throws if path doesn't exist. */
    isDirectory: (absolutePath: string) => Promise<boolean> | boolean;
    /** Read file contents for context lines */
    readFile: (absolutePath: string) => Promise<string> | string;
}
export interface GrepToolOptions {
    /** Custom operations for grep. Default: local filesystem + ripgrep */
    operations?: GrepOperations;
}
export declare function createGrepTool(cwd: string, options?: GrepToolOptions): AgentTool<typeof grepSchema>;
/** Default grep tool using process.cwd() - for backwards compatibility */
export declare const grepTool: AgentTool<import("@sinclair/typebox").TObject<{
    pattern: import("@sinclair/typebox").TString;
    path: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    glob: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TString>;
    ignoreCase: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    literal: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TBoolean>;
    context: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>, any>;
export {};
//# sourceMappingURL=grep.d.ts.map