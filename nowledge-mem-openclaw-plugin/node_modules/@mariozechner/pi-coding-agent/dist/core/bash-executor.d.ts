/**
 * Bash command execution with streaming support and cancellation.
 *
 * This module provides a unified bash execution implementation used by:
 * - AgentSession.executeBash() for interactive and RPC modes
 * - Direct calls from modes that need bash execution
 */
import type { BashOperations } from "./tools/bash.js";
export interface BashExecutorOptions {
    /** Callback for streaming output chunks (already sanitized) */
    onChunk?: (chunk: string) => void;
    /** AbortSignal for cancellation */
    signal?: AbortSignal;
}
export interface BashResult {
    /** Combined stdout + stderr output (sanitized, possibly truncated) */
    output: string;
    /** Process exit code (undefined if killed/cancelled) */
    exitCode: number | undefined;
    /** Whether the command was cancelled via signal */
    cancelled: boolean;
    /** Whether the output was truncated */
    truncated: boolean;
    /** Path to temp file containing full output (if output exceeded truncation threshold) */
    fullOutputPath?: string;
}
/**
 * Execute a bash command with optional streaming and cancellation support.
 *
 * Features:
 * - Streams sanitized output via onChunk callback
 * - Writes large output to temp file for later retrieval
 * - Supports cancellation via AbortSignal
 * - Sanitizes output (strips ANSI, removes binary garbage, normalizes newlines)
 * - Truncates output if it exceeds the default max bytes
 *
 * @param command - The bash command to execute
 * @param options - Optional streaming callback and abort signal
 * @returns Promise resolving to execution result
 */
export declare function executeBash(command: string, options?: BashExecutorOptions): Promise<BashResult>;
/**
 * Execute a bash command using custom BashOperations.
 * Used for remote execution (SSH, containers, etc.).
 */
export declare function executeBashWithOperations(command: string, cwd: string, operations: BashOperations, options?: BashExecutorOptions): Promise<BashResult>;
//# sourceMappingURL=bash-executor.d.ts.map