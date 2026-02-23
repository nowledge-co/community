/**
 * Audit whether agent read required startup files after compaction.
 * Returns list of missing file patterns.
 */
export declare function auditPostCompactionReads(readFilePaths: string[], workspaceDir: string, requiredReads?: Array<string | RegExp>): {
    passed: boolean;
    missingPatterns: string[];
};
/**
 * Read messages from a session JSONL file.
 * Returns messages from the last N lines (default 100).
 */
export declare function readSessionMessages(sessionFile: string, maxLines?: number): Array<{
    role?: string;
    content?: unknown;
}>;
/**
 * Extract file paths from Read tool calls in agent messages.
 * Looks for tool_use blocks with name="read" and extracts path/file_path args.
 */
export declare function extractReadPaths(messages: Array<{
    role?: string;
    content?: unknown;
}>): string[];
/** Format the audit warning message */
export declare function formatAuditWarning(missingPatterns: string[]): string;
