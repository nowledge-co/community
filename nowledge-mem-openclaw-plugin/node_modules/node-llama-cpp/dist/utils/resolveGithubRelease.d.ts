export declare function resolveGithubRelease(githubOwner: string, githubRepo: string, release: string): Promise<any>;
export declare function isGithubReleaseNeedsResolving(release: string): release is "latest";
