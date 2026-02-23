type BinariesGithubReleaseFile = {
    release: "latest" | string;
};
export declare function getBinariesGithubRelease(): Promise<string>;
export declare function setBinariesGithubRelease(release: BinariesGithubReleaseFile["release"]): Promise<void>;
export {};
