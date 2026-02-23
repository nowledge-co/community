import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type Static } from "@sinclair/typebox";
import { type TruncationResult } from "./truncate.js";
declare const bashSchema: import("@sinclair/typebox").TObject<{
    command: import("@sinclair/typebox").TString;
    timeout: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>;
export type BashToolInput = Static<typeof bashSchema>;
export interface BashToolDetails {
    truncation?: TruncationResult;
    fullOutputPath?: string;
}
/**
 * Pluggable operations for the bash tool.
 * Override these to delegate command execution to remote systems (e.g., SSH).
 */
export interface BashOperations {
    /**
     * Execute a command and stream output.
     * @param command - The command to execute
     * @param cwd - Working directory
     * @param options - Execution options
     * @returns Promise resolving to exit code (null if killed)
     */
    exec: (command: string, cwd: string, options: {
        onData: (data: Buffer) => void;
        signal?: AbortSignal;
        timeout?: number;
        env?: NodeJS.ProcessEnv;
    }) => Promise<{
        exitCode: number | null;
    }>;
}
export interface BashSpawnContext {
    command: string;
    cwd: string;
    env: NodeJS.ProcessEnv;
}
export type BashSpawnHook = (context: BashSpawnContext) => BashSpawnContext;
export interface BashToolOptions {
    /** Custom operations for command execution. Default: local shell */
    operations?: BashOperations;
    /** Command prefix prepended to every command (e.g., "shopt -s expand_aliases" for alias support) */
    commandPrefix?: string;
    /** Hook to adjust command, cwd, or env before execution */
    spawnHook?: BashSpawnHook;
}
export declare function createBashTool(cwd: string, options?: BashToolOptions): AgentTool<typeof bashSchema>;
/** Default bash tool using process.cwd() - for backwards compatibility */
export declare const bashTool: AgentTool<import("@sinclair/typebox").TObject<{
    command: import("@sinclair/typebox").TString;
    timeout: import("@sinclair/typebox").TOptional<import("@sinclair/typebox").TNumber>;
}>, any>;
export {};
//# sourceMappingURL=bash.d.ts.map