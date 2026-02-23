/**
 * Only allow one instance of the callback to run at a time for a given `scope` values.
 */
export declare function withLock<ReturnType, const Scope extends readonly any[]>(scope: ValidLockScope<Scope>, callback: () => Promise<ReturnType> | ReturnType): Promise<ReturnType>;
export declare function withLock<ReturnType, const Scope extends readonly any[]>(scope: ValidLockScope<Scope>, acquireLockSignal: AbortSignal | undefined, callback: () => Promise<ReturnType> | ReturnType): Promise<ReturnType>;
/**
 * Check if a lock is currently active for a given `scope` values.
 */
export declare function isLockActive<const Scope extends readonly any[]>(scope: ValidLockScope<Scope>): boolean;
/**
 * Acquire a lock for a given `scope` values.
 */
export declare function acquireLock<const Scope extends readonly any[]>(scope: ValidLockScope<Scope>, acquireLockSignal?: AbortSignal): Promise<Lock<Scope>>;
/**
 * Wait for a lock to be released for a given `scope` values.
 */
export declare function waitForLockRelease<const Scope extends readonly any[]>(scope: ValidLockScope<Scope>, signal?: AbortSignal): Promise<void>;
export type Lock<Scope extends readonly any[] = readonly any[]> = {
    scope: Scope;
    dispose(): void;
    [Symbol.dispose](): void;
};
/**
 * Ensure that the scope array contains at least one object, otherwise it will be `never`.
 */
export type ValidLockScope<T extends readonly unknown[] = readonly unknown[]> = IncludesObject<T> extends true ? Readonly<T & [...T]> : InvalidScopeError<"Scope array must include at least one object reference">;
type IncludesObject<T extends readonly unknown[]> = true extends ({
    [K in keyof T]: readonly [T[K]] extends readonly [object] ? true : false;
}[keyof T]) ? true : false;
type InvalidScopeError<Message extends string> = readonly unknown[] & {
    error: Message;
    __error: never;
};
export {};
//# sourceMappingURL=withLock.d.ts.map