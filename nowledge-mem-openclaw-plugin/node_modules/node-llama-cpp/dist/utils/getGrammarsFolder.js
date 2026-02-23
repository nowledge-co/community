import fs from "fs-extra";
import { llamaBinsGrammarsDirectory, llamaCppGrammarsDirectory } from "../config.js";
import { isLlamaCppRepoCloned } from "../bindings/utils/cloneLlamaCppRepo.js";
export async function getGrammarsFolder(buildType) {
    if (buildType === "localBuild") {
        if (await isLlamaCppRepoCloned(true) && await fs.pathExists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    }
    else if (buildType === "prebuilt") {
        if (await fs.pathExists(llamaBinsGrammarsDirectory))
            return llamaBinsGrammarsDirectory;
        else if (await isLlamaCppRepoCloned(false) && await fs.pathExists(llamaCppGrammarsDirectory))
            return llamaCppGrammarsDirectory;
    }
    else
        void buildType;
    throw new Error("Grammars folder not found");
}
//# sourceMappingURL=getGrammarsFolder.js.map