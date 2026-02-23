/**
 * Bash command execution with streaming support and cancellation.
 *
 * This module provides a unified bash execution implementation used by:
 * - AgentSession.executeBash() for interactive and RPC modes
 * - Direct calls from modes that need bash execution
 */
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "child_process";
import stripAnsi from "strip-ansi";
import { getShellConfig, getShellEnv, killProcessTree, sanitizeBinaryOutput } from "../utils/shell.js";
import { DEFAULT_MAX_BYTES, truncateTail } from "./tools/truncate.js";
// ============================================================================
// Implementation
// ============================================================================
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
export function executeBash(command, options) {
    return new Promise((resolve, reject) => {
        const { shell, args } = getShellConfig();
        const child = spawn(shell, [...args, command], {
            detached: true,
            env: getShellEnv(),
            stdio: ["ignore", "pipe", "pipe"],
        });
        // Track sanitized output for truncation
        const outputChunks = [];
        let outputBytes = 0;
        const maxOutputBytes = DEFAULT_MAX_BYTES * 2;
        // Temp file for large output
        let tempFilePath;
        let tempFileStream;
        let totalBytes = 0;
        // Handle abort signal
        const abortHandler = () => {
            if (child.pid) {
                killProcessTree(child.pid);
            }
        };
        if (options?.signal) {
            if (options.signal.aborted) {
                // Already aborted, don't even start
                child.kill();
                resolve({
                    output: "",
                    exitCode: undefined,
                    cancelled: true,
                    truncated: false,
                });
                return;
            }
            options.signal.addEventListener("abort", abortHandler, { once: true });
        }
        const decoder = new TextDecoder();
        const handleData = (data) => {
            totalBytes += data.length;
            // Sanitize once at the source: strip ANSI, replace binary garbage, normalize newlines
            const text = sanitizeBinaryOutput(stripAnsi(decoder.decode(data, { stream: true }))).replace(/\r/g, "");
            // Start writing to temp file if exceeds threshold
            if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
                const id = randomBytes(8).toString("hex");
                tempFilePath = join(tmpdir(), `pi-bash-${id}.log`);
                tempFileStream = createWriteStream(tempFilePath);
                // Write already-buffered chunks to temp file
                for (const chunk of outputChunks) {
                    tempFileStream.write(chunk);
                }
            }
            if (tempFileStream) {
                tempFileStream.write(text);
            }
            // Keep rolling buffer of sanitized text
            outputChunks.push(text);
            outputBytes += text.length;
            while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
                const removed = outputChunks.shift();
                outputBytes -= removed.length;
            }
            // Stream to callback if provided
            if (options?.onChunk) {
                options.onChunk(text);
            }
        };
        child.stdout?.on("data", handleData);
        child.stderr?.on("data", handleData);
        child.on("close", (code) => {
            // Clean up abort listener
            if (options?.signal) {
                options.signal.removeEventListener("abort", abortHandler);
            }
            if (tempFileStream) {
                tempFileStream.end();
            }
            // Combine buffered chunks for truncation (already sanitized)
            const fullOutput = outputChunks.join("");
            const truncationResult = truncateTail(fullOutput);
            // code === null means killed (cancelled)
            const cancelled = code === null;
            resolve({
                output: truncationResult.truncated ? truncationResult.content : fullOutput,
                exitCode: cancelled ? undefined : code,
                cancelled,
                truncated: truncationResult.truncated,
                fullOutputPath: tempFilePath,
            });
        });
        child.on("error", (err) => {
            // Clean up abort listener
            if (options?.signal) {
                options.signal.removeEventListener("abort", abortHandler);
            }
            if (tempFileStream) {
                tempFileStream.end();
            }
            reject(err);
        });
    });
}
/**
 * Execute a bash command using custom BashOperations.
 * Used for remote execution (SSH, containers, etc.).
 */
export async function executeBashWithOperations(command, cwd, operations, options) {
    const outputChunks = [];
    let outputBytes = 0;
    const maxOutputBytes = DEFAULT_MAX_BYTES * 2;
    let tempFilePath;
    let tempFileStream;
    let totalBytes = 0;
    const decoder = new TextDecoder();
    const onData = (data) => {
        totalBytes += data.length;
        // Sanitize: strip ANSI, replace binary garbage, normalize newlines
        const text = sanitizeBinaryOutput(stripAnsi(decoder.decode(data, { stream: true }))).replace(/\r/g, "");
        // Start writing to temp file if exceeds threshold
        if (totalBytes > DEFAULT_MAX_BYTES && !tempFilePath) {
            const id = randomBytes(8).toString("hex");
            tempFilePath = join(tmpdir(), `pi-bash-${id}.log`);
            tempFileStream = createWriteStream(tempFilePath);
            for (const chunk of outputChunks) {
                tempFileStream.write(chunk);
            }
        }
        if (tempFileStream) {
            tempFileStream.write(text);
        }
        // Keep rolling buffer
        outputChunks.push(text);
        outputBytes += text.length;
        while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
            const removed = outputChunks.shift();
            outputBytes -= removed.length;
        }
        // Stream to callback
        if (options?.onChunk) {
            options.onChunk(text);
        }
    };
    try {
        const result = await operations.exec(command, cwd, {
            onData,
            signal: options?.signal,
        });
        if (tempFileStream) {
            tempFileStream.end();
        }
        const fullOutput = outputChunks.join("");
        const truncationResult = truncateTail(fullOutput);
        const cancelled = options?.signal?.aborted ?? false;
        return {
            output: truncationResult.truncated ? truncationResult.content : fullOutput,
            exitCode: cancelled ? undefined : (result.exitCode ?? undefined),
            cancelled,
            truncated: truncationResult.truncated,
            fullOutputPath: tempFilePath,
        };
    }
    catch (err) {
        if (tempFileStream) {
            tempFileStream.end();
        }
        // Check if it was an abort
        if (options?.signal?.aborted) {
            const fullOutput = outputChunks.join("");
            const truncationResult = truncateTail(fullOutput);
            return {
                output: truncationResult.truncated ? truncationResult.content : fullOutput,
                exitCode: undefined,
                cancelled: true,
                truncated: truncationResult.truncated,
                fullOutputPath: tempFilePath,
            };
        }
        throw err;
    }
}
//# sourceMappingURL=bash-executor.js.map