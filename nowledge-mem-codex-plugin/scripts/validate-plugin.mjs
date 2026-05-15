#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const pluginRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(pluginRoot, "..");
const expectedVersion = "0.1.11";

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
  if (text === null) return null;
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
  ".mcp.json",
  "README.md",
  "CHANGELOG.md",
  "AGENTS.md",
  "hooks/hooks.json",
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
  if (manifest.name !== "nowledge-mem") fail(`unexpected plugin name: ${manifest.name}`);
  else ok("plugin manifest name");
  if (manifest.version !== expectedVersion) fail(`expected version ${expectedVersion}, got ${manifest.version}`);
  else ok("plugin manifest version");
  if (manifest.hooks !== "./hooks/hooks.json") fail("manifest must declare ./hooks/hooks.json");
  else ok("plugin manifest hooks");
  if (manifest.mcpServers !== "./.mcp.json") fail("manifest must declare ./.mcp.json");
  else ok("plugin manifest MCP");
}

const hooks = parseJsonIfPresent(path.join(pluginRoot, "hooks/hooks.json"), "hooks/hooks.json");
if (hooks) {
  const stopHooks = hooks.hooks?.Stop;
  if (!Array.isArray(stopHooks)) fail("hooks/hooks.json must declare Stop hooks");
  else if (!JSON.stringify(stopHooks).includes("nmem-stop-save.py")) fail("Stop hooks must run nmem-stop-save.py");
  else ok("Stop hook capture");
}

const changelog = readTextIfPresent(path.join(pluginRoot, "CHANGELOG.md"), "CHANGELOG.md");
if (changelog !== null) {
  if (!changelog.includes(`## [${expectedVersion}]`)) fail(`CHANGELOG must contain a ${expectedVersion} entry`);
  else ok("CHANGELOG version entry");
}

const integrationsDoc = parseJsonIfPresent(path.join(repoRoot, "integrations.json"), "integrations.json");
if (integrationsDoc) {
  const codexEntry = integrationsDoc.integrations?.find((entry) => entry.id === "codex-cli");
  if (!codexEntry) fail("integrations.json missing codex-cli entry");
  else {
    ok("integrations.json codex-cli entry");
    if (codexEntry.version !== expectedVersion) fail(`integrations.json codex-cli version must be ${expectedVersion}`);
    else ok("integrations.json codex-cli version");
    if (codexEntry.capabilities?.autoCapture !== true) fail("codex-cli autoCapture must be true");
    else ok("codex-cli autoCapture");
    if (codexEntry.autonomy?.threads !== "automatic-capture") fail("codex-cli autonomy.threads must be automatic-capture");
    else ok("codex-cli automatic capture contract");
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("Codex plugin validation passed.");
