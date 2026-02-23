/**
 * Get shell configuration based on platform.
 * Resolution order:
 * 1. User-specified shellPath in settings.json
 * 2. On Windows: Git Bash in known locations, then bash on PATH
 * 3. On Unix: /bin/bash, then bash on PATH, then fallback to sh
 */
export declare function getShellConfig(): {
    shell: string;
    args: string[];
};
export declare function getShellEnv(): NodeJS.ProcessEnv;
/**
 * Sanitize binary output for display/storage.
 * Removes characters that crash string-width or cause display issues:
 * - Control characters (except tab, newline, carriage return)
 * - Lone surrogates
 * - Unicode Format characters (crash string-width due to a bug)
 * - Characters with undefined code points
 */
export declare function sanitizeBinaryOutput(str: string): string;
/**
 * Kill a process and all its children (cross-platform)
 */
export declare function killProcessTree(pid: number): void;
//# sourceMappingURL=shell.d.ts.map