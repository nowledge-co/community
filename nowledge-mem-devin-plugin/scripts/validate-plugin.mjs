#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const community = resolve(root, "..");
const errors = [];
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return {};
  }
};

const manifest = readJson(join(root, ".devin-plugin", "plugin.json"));
if (manifest.name !== "nowledge-mem") errors.push("manifest name must be nowledge-mem");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) errors.push("manifest version must be semver");

const hooks = readJson(join(root, "hooks.json"));
const expectedHookEvents = ["PostCompaction", "SessionEnd", "Stop"];
if (JSON.stringify(Object.keys(hooks).sort()) !== JSON.stringify(expectedHookEvents)) {
  errors.push(`hooks must contain only ${expectedHookEvents.join(", ")}`);
}
for (const event of ["Stop", "PostCompaction", "SessionEnd"]) {
  const command = hooks[event]?.[0]?.hooks?.[0]?.command || "";
  if (command !== "nmem --json t sync --from devin --hook-stdin --apply") {
    errors.push(`${event} must use exact Devin hook session capture`);
  }
  const timeout = hooks[event]?.[0]?.hooks?.[0]?.timeout;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 30) {
    errors.push(`${event} must have a bounded timeout of at most 30 seconds`);
  }
}
if (hooks.SessionStart) errors.push("SessionStart is unsupported in Devin Cloud");

const mcp = readJson(join(root, "mcp_config.json"));
if (existsSync(join(root, ".mcp.json"))) {
  errors.push("Devin loads mcp_config.json, not .mcp.json");
}
const server = mcp.mcpServers?.["nowledge-mem"];
if (server?.serverUrl !== "http://127.0.0.1:14242/mcp") {
  errors.push("bundled MCP must remain credential-free loopback");
}
if (JSON.stringify(mcp).match(/api[_-]?key|authorization|bearer/i)) {
  errors.push("bundled MCP must not contain credentials");
}

const skillRoot = join(root, "skills");
for (const entry of readdirSync(skillRoot)) {
  const path = join(skillRoot, entry);
  if (!statSync(path).isDirectory()) continue;
  const skillFile = join(path, "SKILL.md");
  if (!existsSync(skillFile)) {
    errors.push(`skills/${entry} is missing SKILL.md`);
    continue;
  }
  const text = readFileSync(skillFile, "utf8");
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    errors.push(`skills/${entry}/SKILL.md is missing YAML frontmatter`);
    continue;
  }
  if (!frontmatter[1].split(/\r?\n/).some((line) => line.trim() === `name: ${entry}`)) {
    errors.push(`skills/${entry}/SKILL.md frontmatter name must match its directory`);
  }
  if (!frontmatter[1].split(/\r?\n/).some((line) => line.startsWith("description:"))) {
    errors.push(`skills/${entry}/SKILL.md frontmatter is missing description`);
  }
}

const registry = readJson(join(community, "integrations.json"));
const integration = registry.integrations?.find((item) => item.id === "devin");
if (!integration) errors.push("integrations.json is missing devin");
if (integration?.version !== manifest.version) errors.push("registry version must match manifest");
if (integration?.threadSave?.method !== "hook+cli-native+api-v3") {
  errors.push("registry must describe the verified capture planes");
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}
console.log("Devin plugin validation passed.");
