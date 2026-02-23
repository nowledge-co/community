export declare function hasBuiltinCmake(): Promise<boolean>;
export declare function getCmakePath(): Promise<string>;
export declare function downloadCmakeIfNeeded(wrapWithStatusLogs?: boolean): Promise<void>;
export declare function clearLocalCmake(): Promise<void>;
/**
 * There's an issue where after a compilation, the cmake binaries have permissions that don't allow them to be deleted.
 * This function fixes that.
 * It should be run after each compilation.
 */
export declare function fixXpackPermissions(): Promise<void>;
