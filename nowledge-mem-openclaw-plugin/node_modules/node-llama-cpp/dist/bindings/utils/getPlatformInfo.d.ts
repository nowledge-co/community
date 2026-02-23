export declare function getPlatformInfo(): Promise<{
    name: string;
    version: string;
}>;
export type BinaryPlatformInfo = Awaited<ReturnType<typeof getPlatformInfo>>;
