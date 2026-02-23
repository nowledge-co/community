/**
 * Only allow one instance of the callback to run at a time for a given `scope` and `key`.
 */
export declare function withLock<ReturnType, const ScopeType = any>(scope: ScopeType, key: string, callback: (this: ScopeType) => Promise<ReturnType>): Promise<ReturnType>;
export declare function withLock<ReturnType, const ScopeType = any>(scope: ScopeType, key: string, acquireLockSignal: AbortSignal | undefined, callback: (this: ScopeType) => Promise<ReturnType>): Promise<ReturnType>;
/**
 * Check if a lock is currently active for a given `scope` and `key`.
 */
export declare function isLockActive(scope: any, key: string): boolean;
/**
 * Acquire a lock for a given `scope` and `key`.
 */
export declare function acquireLock<S = any, K extends string = string>(scope: S, key: K, acquireLockSignal?: AbortSignal): Promise<Lock<S, K>>;
/**
 * Wait for a lock to be released for a given `scope` and `key`.
 */
export declare function waitForLockRelease(scope: any, key: string, signal?: AbortSignal): Promise<void>;
export type Lock<S = any, K extends string = string> = {
    scope: S;
    key: K;
    dispose(): void;
    [Symbol.dispose](): void;
};
