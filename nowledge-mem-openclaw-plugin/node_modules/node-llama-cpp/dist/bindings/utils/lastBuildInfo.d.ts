type LastBuildInfo = {
    folderName: string;
};
export declare function getLastBuildInfo(): Promise<LastBuildInfo | null>;
export declare function setLastBuildInfo(buildInfo: LastBuildInfo): Promise<void>;
export {};
