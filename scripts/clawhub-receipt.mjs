// Use the pinned CLI's own ignore/text-file rules; npm pack has a different surface.
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { listTextFiles, hashSkillFiles } = await import(pathToFileURL(process.argv[2] + "/clawhub/dist/skills.js"));
const { files } = hashSkillFiles(await listTextFiles("nowledge-mem-openclaw-plugin"));
if (!files.some((file) => file.path === "src/index.js")) throw new Error("Missing plugin code");
if (files.some((file) => /^(tests|scripts|node_modules)\//.test(file.path))) throw new Error("Unexpected build/test files");
writeFileSync("clawhub-pack.json", JSON.stringify(files, null, 2));
