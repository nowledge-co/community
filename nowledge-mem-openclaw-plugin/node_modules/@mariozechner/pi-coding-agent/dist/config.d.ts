/**
 * Detect if we're running as a Bun compiled binary.
 * Bun binaries have import.meta.url containing "$bunfs", "~BUN", or "%7EBUN" (Bun's virtual filesystem path)
 */
export declare const isBunBinary: boolean;
/** Detect if Bun is the runtime (compiled binary or bun run) */
export declare const isBunRuntime: boolean;
export type InstallMethod = "bun-binary" | "npm" | "pnpm" | "yarn" | "bun" | "unknown";
export declare function detectInstallMethod(): InstallMethod;
export declare function getUpdateInstruction(packageName: string): string;
/**
 * Get the base directory for resolving package assets (themes, package.json, README.md, CHANGELOG.md).
 * - For Bun binary: returns the directory containing the executable
 * - For Node.js (dist/): returns __dirname (the dist/ directory)
 * - For tsx (src/): returns parent directory (the package root)
 */
export declare function getPackageDir(): string;
/**
 * Get path to built-in themes directory (shipped with package)
 * - For Bun binary: theme/ next to executable
 * - For Node.js (dist/): dist/modes/interactive/theme/
 * - For tsx (src/): src/modes/interactive/theme/
 */
export declare function getThemesDir(): string;
/**
 * Get path to HTML export template directory (shipped with package)
 * - For Bun binary: export-html/ next to executable
 * - For Node.js (dist/): dist/core/export-html/
 * - For tsx (src/): src/core/export-html/
 */
export declare function getExportTemplateDir(): string;
/** Get path to package.json */
export declare function getPackageJsonPath(): string;
/** Get path to README.md */
export declare function getReadmePath(): string;
/** Get path to docs directory */
export declare function getDocsPath(): string;
/** Get path to examples directory */
export declare function getExamplesPath(): string;
/** Get path to CHANGELOG.md */
export declare function getChangelogPath(): string;
export declare const APP_NAME: string;
export declare const CONFIG_DIR_NAME: string;
export declare const VERSION: string;
export declare const ENV_AGENT_DIR: string;
/** Get the share viewer URL for a gist ID */
export declare function getShareViewerUrl(gistId: string): string;
/** Get the agent config directory (e.g., ~/.pi/agent/) */
export declare function getAgentDir(): string;
/** Get path to user's custom themes directory */
export declare function getCustomThemesDir(): string;
/** Get path to models.json */
export declare function getModelsPath(): string;
/** Get path to auth.json */
export declare function getAuthPath(): string;
/** Get path to settings.json */
export declare function getSettingsPath(): string;
/** Get path to tools directory */
export declare function getToolsDir(): string;
/** Get path to managed binaries directory (fd, rg) */
export declare function getBinDir(): string;
/** Get path to prompt templates directory */
export declare function getPromptsDir(): string;
/** Get path to sessions directory */
export declare function getSessionsDir(): string;
/** Get path to debug log file */
export declare function getDebugLogPath(): string;
//# sourceMappingURL=config.d.ts.map