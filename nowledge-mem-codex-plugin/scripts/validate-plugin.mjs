#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
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

for (const file of [
  ".codex-plugin/plugin.json",
  "README.md",
  "CHANGELOG.md",
  "RELEASING.md",
  "hooks/nmem-stop-save.py",
  "scripts/install_hooks.py",
  "scripts/validate-plugin.mjs",
  "skills/working-memory/SKILL.md",
  "skills/search-memory/SKILL.md",
  "skills/save-thread/SKILL.md",
  "skills/distill-memory/SKILL.md",
  "skills/status/SKILL.md",
]) {
  requireFile(file);
}

const manifest = JSON.parse(
  readFileSync(path.join(pluginRoot, ".codex-plugin/plugin.json"), "utf8"),
);
if (manifest.name !== "nowledge-mem") {
  fail(`unexpected plugin name: ${manifest.name}`);
} else {
  ok("plugin manifest name");
}
if (manifest.version !== "0.1.3") {
  fail(`expected version 0.1.3, got ${manifest.version}`);
} else {
  ok("plugin manifest version");
}

const changelog = readFileSync(path.join(pluginRoot, "CHANGELOG.md"), "utf8");
if (!changelog.includes("## [0.1.3]")) {
  fail("CHANGELOG must contain a 0.1.3 entry");
} else {
  ok("CHANGELOG version entry");
}

const readme = readFileSync(path.join(pluginRoot, "README.md"), "utf8");
for (const phrase of [
  "scripts/install_hooks.py",
  "~/.codex/hooks.json",
  "codex_hooks = true",
  "host-level",
]) {
  if (!readme.includes(phrase)) {
    fail(`README must mention ${phrase}`);
  } else {
    ok(`README mentions ${phrase}`);
  }
}

const integrationsDoc = JSON.parse(
  readFileSync(path.join(repoRoot, "integrations.json"), "utf8"),
);
const codexEntry = integrationsDoc.integrations?.find((entry) => entry.id === "codex-cli");
if (!codexEntry) {
  fail("integrations.json missing codex-cli entry");
} else {
  ok("integrations.json codex-cli entry");
  if (codexEntry.version !== "0.1.3") {
    fail(`integrations.json codex-cli version must be 0.1.3, got ${codexEntry.version}`);
  } else {
    ok("integrations.json codex-cli version");
  }
  if (!codexEntry.install?.command?.includes("nowledge-mem-codex-plugin/.")) {
    fail("integrations.json install.command must copy nowledge-mem-codex-plugin/. so hidden files are preserved");
  } else {
    ok("integrations.json install.command copies hidden files");
  }
  if (!codexEntry.install?.updateCommand?.includes("nowledge-mem-codex-plugin/.")) {
    fail("integrations.json install.updateCommand must copy nowledge-mem-codex-plugin/. so hidden files are preserved");
  } else {
    ok("integrations.json updateCommand copies hidden files");
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Codex plugin validation passed.");
