type ClonedLlamaCppRepoTagFile = {
    tag: string;
    llamaCppGithubRepo: string;
};
export declare function cloneLlamaCppRepo(githubOwner: string, githubRepo: string, tag: string, useBundles?: boolean, progressLogs?: boolean, recursive?: boolean): Promise<void>;
export declare function getClonedLlamaCppRepoReleaseInfo(): Promise<ClonedLlamaCppRepoTagFile | null>;
export declare function isLlamaCppRepoCloned(waitForLock?: boolean): Promise<boolean>;
export declare function ensureLlamaCppRepoIsCloned({ progressLogs }?: {
    progressLogs?: boolean;
}): Promise<void>;
export {};
