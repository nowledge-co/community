import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static } from "@sinclair/typebox";
import { type TruncationResult } from "./truncate.js";
declare const readSchema: import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TString;
    offset: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export type ReadToolInput = Static<typeof readSchema>;
export interface ReadToolDetails {
    truncation?: TruncationResult;
}
/**
 * Pluggable operations for the read tool.
 * Override these to delegate file reading to remote systems (e.g., SSH).
 */
export interface ReadOperations {
    /** Read file contents as a Buffer */
    readFile: (absolutePath: string) => Promise<Buffer>;
    /** Check if file is readable (throw if not) */
    access: (absolutePath: string) => Promise<void>;
    /** Detect image MIME type, return null/undefined for non-images */
    detectImageMimeType?: (absolutePath: string) => Promise<string | null | undefined>;
}
export interface ReadToolOptions {
    /** Whether to auto-resize images to 2000x2000 max. Default: true */
    autoResizeImages?: boolean;
    /** Custom operations for file reading. Default: local filesystem */
    operations?: ReadOperations;
}
export declare function createReadTool(cwd: string, options?: ReadToolOptions): AgentTool<typeof readSchema>;
/** Default read tool using process.cwd() - for backwards compatibility */
export declare const readTool: AgentTool<import("@sinclair/typebox").TObject<{
    path: import("@sinclair/typebox").TString;
    offset: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
    limit: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>, any>;
export {};
//# sourceMappingURL=read.d.ts.map