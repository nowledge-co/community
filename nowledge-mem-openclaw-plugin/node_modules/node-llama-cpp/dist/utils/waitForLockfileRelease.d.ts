export declare function waitForLockfileRelease({ resourcePath, checkInterval, staleDuration }: {
    resourcePath: string;
    checkInterval?: number;
    staleDuration?: number;
}): Promise<void>;
