export declare const lockfileLockScope: {};
export declare function withLockfile<const T>({ resourcePath, staleDuration, updateInterval, retries }: {
    resourcePath: string;
    staleDuration?: number;
    updateInterval?: number;
    retries?: number;
}, callback: () => T | Promise<T>): Promise<T>;
