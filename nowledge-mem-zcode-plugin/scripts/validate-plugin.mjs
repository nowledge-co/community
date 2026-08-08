#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(pluginRoot, ".zcode-plugin", "plugin.json");
const marketplacePath = join(pluginRoot, "marketplace.json");
const mcpPath = join(pluginRoot, ".mcp.json");
const expectedSkills = [
  "check-integration",
  "read-working-memory",
  "search-memory",
  "distill-memory",
  "save-handoff",
  "status",
];

function fail(message) {
  console.error(`ZCode plugin validation failed: ${message}`);
  process.exitCode = 1;
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not valid JSON: ${detail}`);
  }
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateManifest(manifest) {
  requireString(manifest.name, "manifest.name");
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(manifest.name)) {
    throw new Error("manifest.name does not match the ZCode name format");
  }
  requireString(manifest.version, "manifest.version");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new Error("manifest.version must be a semantic version");
  }
  requireString(manifest.description, "manifest.description");
  if (!manifest.author || typeof manifest.author !== "object") {
    throw new Error("manifest.author must be an object");
  }
  requireString(manifest.author.name, "manifest.author.name");
  if (manifest.hooks !== undefined || manifest.agents !== undefined) {
    throw new Error("0.1.0 does not declare unverified hooks or agents");
  }
}

function validateMarketplace(marketplace, manifest) {
  if (!marketplace || typeof marketplace !== "object") {
    throw new Error("marketplace.json must contain an object");
  }
  requireString(marketplace.name, "marketplace.name");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
    throw new Error("marketplace.json must declare exactly one plugin");
  }
  const plugin = marketplace.plugins[0];
  if (!plugin || plugin.name !== manifest.name || plugin.version !== manifest.version) {
    throw new Error("marketplace plugin name/version must match plugin.json");
  }
  if (plugin.source !== ".") {
    throw new Error("marketplace plugin source must be the standalone package root (.)");
  }
  if (plugin.repository !== "https://github.com/nowledge-co/zcode-plugin") {
    throw new Error("marketplace plugin repository must point to the standalone repository");
  }
}

function validateMcp(mcp) {
  if (!mcp.mcpServers || typeof mcp.mcpServers !== "object") {
    throw new Error(".mcp.json must contain mcpServers");
  }
  const names = Object.keys(mcp.mcpServers);
  if (names.length !== 1 || names[0] !== "nowledge-mem") {
    throw new Error(".mcp.json must declare exactly the nowledge-mem server");
  }
  const server = mcp.mcpServers["nowledge-mem"];
  if (!server || server.type !== "http") {
    throw new Error("nowledge-mem MCP server must use the ZCode http transport");
  }
  requireString(server.url, "nowledge-mem.url");
  const url = new URL(server.url);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("nowledge-mem.url must use http or https");
  }
  const serialized = JSON.stringify(mcp).toLowerCase();
  for (const forbidden of ["api-key", "api_key", "authorization", "bearer", "password", "secret"]) {
    if (serialized.includes(forbidden)) {
      throw new Error(`.mcp.json contains a credential field: ${forbidden}`);
    }
  }
}

function validateSkills() {
  const skillsRoot = join(pluginRoot, "skills");
  const actualSkills = readdirSync(skillsRoot).filter((name) =>
    statSync(join(skillsRoot, name)).isDirectory(),
  ).sort();
  if (JSON.stringify(actualSkills) !== JSON.stringify([...expectedSkills].sort())) {
    throw new Error(`skills must be exactly: ${expectedSkills.join(", ")}`);
  }
  for (const skillName of expectedSkills) {
    const skillPath = join(skillsRoot, skillName, "SKILL.md");
    const source = readFileSync(skillPath, "utf8");
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!match) {
      throw new Error(`${relative(pluginRoot, skillPath)} is missing YAML frontmatter`);
    }
    const frontmatter = match[1];
    const name = frontmatter.match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = frontmatter.match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (name !== skillName) {
      throw new Error(`${relative(pluginRoot, skillPath)} has frontmatter name ${name ?? "<missing>"}`);
    }
    if (!description || description.length > 1024) {
      throw new Error(`${relative(pluginRoot, skillPath)} needs a description of 1-1024 characters`);
    }
    if (/^name:\s*save-thread\s*$/m.test(frontmatter)) {
      throw new Error(`${relative(pluginRoot, skillPath)} must not declare save-thread`);
    }
  }
}

try {
  const manifest = readJson(manifestPath, ".zcode-plugin/plugin.json");
  validateManifest(manifest);
  validateMarketplace(readJson(marketplacePath, "marketplace.json"), manifest);
  validateMcp(readJson(mcpPath, ".mcp.json"));
  validateSkills();
  for (const forbiddenPath of ["hooks", "agents"]) {
    try {
      statSync(join(pluginRoot, forbiddenPath));
      throw new Error(`unexpected ${forbiddenPath}/ directory`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  console.log("ZCode plugin validation passed");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
