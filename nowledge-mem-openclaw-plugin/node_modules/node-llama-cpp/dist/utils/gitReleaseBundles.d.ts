export declare function unshallowAndSquashCurrentRepoAndSaveItAsReleaseBundle(): Promise<void>;
export declare function getGitBundlePathForRelease(githubOwner: string, githubRepo: string, release: string): Promise<string | null>;
