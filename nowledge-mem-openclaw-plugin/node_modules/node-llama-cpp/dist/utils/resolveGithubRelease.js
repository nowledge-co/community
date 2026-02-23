import { Octokit } from "octokit";
import { getConsoleLogPrefix } from "./getConsoleLogPrefix.js";
export async function resolveGithubRelease(githubOwner, githubRepo, release) {
    const octokit = new Octokit();
    const repo = githubOwner + "/" + githubRepo;
    let githubRelease = null;
    try {
        if (release === "latest") {
            githubRelease = await octokit.rest.repos.getLatestRelease({
                owner: githubOwner,
                repo: githubRepo
            });
        }
        else {
            githubRelease = await octokit.rest.repos.getReleaseByTag({
                owner: githubOwner,
                repo: githubRepo,
                tag: release
            });
        }
    }
    catch (err) {
        console.error(getConsoleLogPrefix() + "Failed to fetch llama.cpp release info", err);
    }
    if (githubRelease == null) {
        throw new Error(`Failed to find release "${release}" of "${repo}"`);
    }
    if (githubRelease.data.tag_name == null) {
        throw new Error(`Failed to find tag of release "${release}" of "${repo}"`);
    }
    return githubRelease.data.tag_name;
}
export function isGithubReleaseNeedsResolving(release) {
    return release === "latest";
}
//# sourceMappingURL=resolveGithubRelease.js.map