import fs from "fs-extra";
const osReleasePaths = [
    "/etc/os-release",
    "/usr/lib/os-release"
];
export async function getLinuxDistroInfo() {
    const osReleaseInfo = await getOsReleaseInfo();
    return {
        name: osReleaseInfo.get("name") ?? "",
        id: osReleaseInfo.get("id") ?? "",
        version: osReleaseInfo.get("version_id") ?? osReleaseInfo.get("version") ?? "",
        versionCodename: osReleaseInfo.get("version_codename") ?? "",
        prettyName: osReleaseInfo.get("pretty_name") ?? ""
    };
}
export async function isDistroAlpineLinux(linuxDistroInfo) {
    return linuxDistroInfo.id === "alpine" || linuxDistroInfo.name.toLowerCase().startsWith("alpine") ||
        linuxDistroInfo.prettyName.toLowerCase().startsWith("alpine");
}
async function getOsReleaseInfo() {
    for (const osReleasePath of osReleasePaths) {
        try {
            if (!(await fs.pathExists(osReleasePath)))
                continue;
            const osReleaseFile = await fs.readFile(osReleasePath, "utf8");
            const res = new Map();
            for (const line of osReleaseFile.split("\n")) {
                const equalsSignIndex = line.indexOf("=");
                // ignore lines with no key
                if (equalsSignIndex < 1)
                    continue;
                const key = line.slice(0, equalsSignIndex).toLowerCase();
                let value = line.slice(equalsSignIndex + 1);
                if (value.startsWith('"') && value.endsWith('"'))
                    value = value.slice(1, -1);
                res.set(key, value);
            }
            return res;
        }
        catch (err) {
            continue;
        }
    }
    return new Map();
}
//# sourceMappingURL=getLinuxDistroInfo.js.map