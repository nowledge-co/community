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

const readTextIfPresent = (fullPath, label) => {
  if (!existsSync(fullPath)) {
    fail(`missing ${label}`);
    return null;
  }
  try {
    return readFileSync(fullPath, "utf8");
  } catch (error) {
    fail(`failed to read ${label}: ${error.message}`);
    return null;
  }
};

const parseJsonIfPresent = (fullPath, label) => {
  const text = readTextIfPresent(fullPath, label);
  if (text === null) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    fail(`failed to parse ${label}: ${error.message}`);
    return null;
  }
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

const manifest = parseJsonIfPresent(
  path.join(pluginRoot, ".codex-plugin/plugin.json"),
  ".codex-plugin/plugin.json",
);
if (manifest) {
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
}

const changelog = readTextIfPresent(path.join(pluginRoot, "CHANGELOG.md"), "CHANGELOG.md");
if (changelog !== null) {
  if (!changelog.includes("## [0.1.3]")) {
    fail("CHANGELOG must contain a 0.1.3 entry");
  } else {
    ok("CHANGELOG version entry");
  }
}

const readme = readTextIfPresent(path.join(pluginRoot, "README.md"), "README.md");
if (readme !== null) {
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
}

const integrationsDoc = parseJsonIfPresent(path.join(repoRoot, "integrations.json"), "integrations.json");
if (integrationsDoc) {
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
    if (!codexEntry.install?.command?.includes("install_hooks.py")) {
      fail("integrations.json install.command must run scripts/install_hooks.py so Codex auto-capture is actually enabled");
    } else {
      ok("integrations.json install.command runs install_hooks.py");
    }
    if (!codexEntry.install?.updateCommand?.includes("nowledge-mem-codex-plugin/.")) {
      fail("integrations.json install.updateCommand must copy nowledge-mem-codex-plugin/. so hidden files are preserved");
    } else {
      ok("integrations.json updateCommand copies hidden files");
    }
    if (!codexEntry.install?.updateCommand?.includes("install_hooks.py")) {
      fail("integrations.json install.updateCommand must rerun scripts/install_hooks.py so hook config stays current");
    } else {
      ok("integrations.json updateCommand runs install_hooks.py");
    }
    if (codexEntry.capabilities?.autoCapture !== true) {
      fail(`integrations.json codex-cli autoCapture must be true, got ${codexEntry.capabilities?.autoCapture}`);
    } else {
      ok("integrations.json codex-cli autoCapture");
    }
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Codex plugin validation passed.");
