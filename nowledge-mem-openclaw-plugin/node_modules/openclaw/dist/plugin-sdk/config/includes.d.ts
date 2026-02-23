/**
 * Config includes: $include directive for modular configs
 *
 * @example
 * ```json5
 * {
 *   "$include": "./base.json5",           // single file
 *   "$include": ["./a.json5", "./b.json5"] // merge multiple
 * }
 * ```
 */
export declare const INCLUDE_KEY = "$include";
export declare const MAX_INCLUDE_DEPTH = 10;
export type IncludeResolver = {
    readFile: (path: string) => string;
    parseJson: (raw: string) => unknown;
};
export declare class ConfigIncludeError extends Error {
    readonly includePath: string;
    readonly cause?: Error | undefined;
    constructor(message: string, includePath: string, cause?: Error | undefined);
}
export declare class CircularIncludeError extends ConfigIncludeError {
    readonly chain: string[];
    constructor(chain: string[]);
}
/** Deep merge: arrays concatenate, objects merge recursively, primitives: source wins */
export declare function deepMerge(target: unknown, source: unknown): unknown;
/**
 * Resolves all $include directives in a parsed config object.
 */
export declare function resolveConfigIncludes(obj: unknown, configPath: string, resolver?: IncludeResolver): unknown;
