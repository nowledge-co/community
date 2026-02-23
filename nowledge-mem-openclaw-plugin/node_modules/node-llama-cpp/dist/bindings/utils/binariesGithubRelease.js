import fs from "fs-extra";
import { binariesGithubReleasePath } from "../../config.js";
export async function getBinariesGithubRelease() {
    const binariesGithubRelease = await fs.readJson(binariesGithubReleasePath);
    return binariesGithubRelease.release;
}
export async function setBinariesGithubRelease(release) {
    const binariesGithubReleaseJson = {
        release: release
    };
    await fs.writeJson(binariesGithubReleasePath, binariesGithubReleaseJson, {
        spaces: 4
    });
}
//# sourceMappingURL=binariesGithubRelease.js.map