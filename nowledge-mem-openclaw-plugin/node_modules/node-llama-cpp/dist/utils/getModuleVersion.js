import path from "path";
import { fileURLToPath } from "url";
import fs from "fs-extra";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
let moduleVersion = null;
export async function getModuleVersion() {
    if (moduleVersion != null)
        return moduleVersion;
    const packageJson = await fs.readJson(path.join(__dirname, "..", "..", "package.json"));
    moduleVersion = packageJson.version;
    return moduleVersion;
}
//# sourceMappingURL=getModuleVersion.js.map