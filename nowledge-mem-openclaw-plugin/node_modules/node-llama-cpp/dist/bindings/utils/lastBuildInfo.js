import fs from "fs-extra";
import { lastBuildInfoJsonPath } from "../../config.js";
export async function getLastBuildInfo() {
    try {
        const buildInfo = await fs.readJson(lastBuildInfoJsonPath);
        return buildInfo;
    }
    catch (err) {
        return null;
    }
}
export async function setLastBuildInfo(buildInfo) {
    await fs.writeJson(lastBuildInfoJsonPath, buildInfo, {
        spaces: 4
    });
}
//# sourceMappingURL=lastBuildInfo.js.map