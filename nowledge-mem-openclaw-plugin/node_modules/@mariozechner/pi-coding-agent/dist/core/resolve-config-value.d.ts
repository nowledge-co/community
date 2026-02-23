/**
 * Resolve configuration values that may be shell commands, environment variables, or literals.
 * Used by auth-storage.ts and model-registry.ts.
 */
/**
 * Resolve a config value (API key, header value, etc.) to an actual value.
 * - If starts with "!", executes the rest as a shell command and uses stdout (cached)
 * - Otherwise checks environment variable first, then treats as literal (not cached)
 */
export declare function resolveConfigValue(config: string): string | undefined;
/**
 * Resolve all header values using the same resolution logic as API keys.
 */
export declare function resolveHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined;
/** Clear the config value command cache. Exported for testing. */
export declare function clearConfigValueCache(): void;
//# sourceMappingURL=resolve-config-value.d.ts.map