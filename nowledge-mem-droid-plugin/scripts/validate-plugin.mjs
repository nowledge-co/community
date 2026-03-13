#!/usr/bin/env node

import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const pluginRoot = path.resolve(process.cwd());
const repoRoot = path.resolve(pluginRoot, "..");

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};

const ok = (message) => {
  console.log(`OK: ${message}`);
};

const requireFile = (relativePath) => {
  const fullPath = path.join(pluginRoot, relativePath);
  if (!existsSync(fullPath)) {
    fail(`missing ${relativePath}`);
    return null;
  }
  const stats = statSync(fullPath);
  if (!stats.isFile() || stats.size === 0) {
    fail(`empty or non-file ${relativePath}`);
    return null;
  }
  ok(relativePath);
  return fullPath;
};

const requiredFiles = [
  ".factory-plugin/plugin.json",
  "README.md",
  "CHANGELOG.md",
  "RELEASING.md",
  "hooks/hooks.json",
  "commands/nowledge-read-working-memory.md",
  "commands/nowledge-search-memory.md",
  "commands/nowledge-distill-memory.md",
  "commands/nowledge-save-handoff.md",
  "commands/nowledge-status.md",
  "skills/read-working-memory/SKILL.md",
  "skills/search-memory/SKILL.md",
  "skills/distill-memory/SKILL.md",
  "skills/save-handoff/SKILL.md"
];

for (const file of requiredFiles) {
  requireFile(file);
}

const pluginManifestPath = path.join(pluginRoot, ".factory-plugin/plugin.json");
const marketplacePath = path.join(repoRoot, ".factory-plugin/marketplace.json");

try {
  const pluginManifest = JSON.parse(readFileSync(pluginManifestPath, "utf8"));
  if (pluginManifest.name !== "nowledge-mem") {
    fail(`unexpected plugin name: ${pluginManifest.name}`);
  } else {
    ok("plugin manifest name");
  }
  if (!pluginManifest.version) {
    fail("plugin manifest missing version");
  } else {
    ok("plugin manifest version");
  }
} catch (error) {
  fail(`invalid plugin manifest JSON: ${error.message}`);
}

try {
  const marketplace = JSON.parse(readFileSync(marketplacePath, "utf8"));
  const entry = marketplace.plugins?.find((plugin) => plugin.name === "nowledge-mem");
  if (!entry) {
    fail("root Factory marketplace is missing nowledge-mem entry");
  } else if (entry.source !== "./nowledge-mem-droid-plugin") {
    fail(`unexpected marketplace source: ${entry.source}`);
  } else {
    ok("root Factory marketplace entry");
  }
  if (!marketplace.description) {
    fail("root Factory marketplace should include a marketplace description");
  } else {
    ok("root Factory marketplace description");
  }
} catch (error) {
  fail(`invalid root marketplace JSON: ${error.message}`);
}

const readText = (relativePath) => readFileSync(path.join(pluginRoot, relativePath), "utf8");

const readme = readText("README.md");
if (!readme.includes("save-handoff")) {
  fail("README must mention save-handoff");
} else {
  ok("README mentions save-handoff");
}
if (!readme.includes("does **not** expose `save-thread`")) {
  fail("README must explicitly state that save-thread is unavailable");
} else {
  ok("README documents save-thread boundary");
}

const runtimeSurfaceFiles = [
  "README.md",
  "hooks/hooks.json",
  "commands/nowledge-read-working-memory.md",
  "commands/nowledge-search-memory.md",
  "commands/nowledge-distill-memory.md",
  "commands/nowledge-save-handoff.md",
  "commands/nowledge-status.md",
  "skills/read-working-memory/SKILL.md",
  "skills/search-memory/SKILL.md",
  "skills/distill-memory/SKILL.md",
  "skills/save-handoff/SKILL.md"
];

const pluginText = runtimeSurfaceFiles
  .map((file) => readText(file))
  .join("\n");

if (pluginText.includes("nmem t save --from droid")) {
  fail("plugin must not claim unsupported nmem t save --from droid behavior");
} else {
  ok("no fake Droid transcript importer claim");
}

if (pluginText.includes("python3")) {
  fail("plugin should not require python3 just to load Working Memory");
} else {
  ok("no python3 dependency in plugin runtime surfaces");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Factory Droid plugin validation passed.");
