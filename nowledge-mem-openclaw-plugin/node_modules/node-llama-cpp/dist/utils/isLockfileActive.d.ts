export declare function isLockfileActive({ resourcePath, staleDuration }: {
    resourcePath: string;
    staleDuration?: number;
}): Promise<boolean>;
