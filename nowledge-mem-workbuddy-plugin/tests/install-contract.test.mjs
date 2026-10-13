import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const registry = JSON.parse(read("../../integrations.json")).integrations.find((entry) => entry.id === "workbuddy");

test("desktop onboarding leads with marketplace UI and explicit connector trust", () => {
  const readme = read("../README.md");
  assert.match(readme, /Plugins.*\+/);
  assert.match(readme, /Trust/);
  assert.match(registry.install.command, /Plugins.*\+/);
  assert.match(registry.install.configRequired, /Trust/);
  const row = read("../../README.md").split("\n").find((line) => line.includes("**[WorkBuddy Plugin]"));
  assert.match(row, /Plugins.*\+/);
  assert.match(row, /Trust/);
});

test("ordinary updates do not remove the marketplace or change enablement", () => {
  assert.doesNotMatch(registry.install.updateCommand, /marketplace remove/);
  assert.match(registry.install.updateCommand, /Update/);
});

test("bundled MCP declares exact Spaces semantics without embedding keys", () => {
  const server = JSON.parse(read("../.mcp.json")).mcpServers["nowledge-mem"];
  assert.equal(server.url, "http://127.0.0.1:14242/mcp");
  assert.equal(server.headers.APP, "WorkBuddy");
  assert.equal(server.headers["x-nmem-space-protocol"], "exact-v1");
  assert.equal(server.headers.Authorization, undefined);
  assert.equal(server.headers["X-NMEM-API-Key"], undefined);
});

test("marketplace and registry deliver the same self-contained package version", () => {
  const marketplace = JSON.parse(read("../../.workbuddy-plugin/marketplace.json"));
  const plugin = marketplace.plugins.find((entry) => entry.name === "nowledge-mem");
  const manifest = JSON.parse(read("../.workbuddy-plugin/plugin.json"));
  assert.equal(plugin.version, manifest.version);
  assert.equal(registry.version, manifest.version);
  assert.equal(plugin.source.subdir, registry.directory);
  for (const path of ["../skills/nowledge-mem/SKILL.md", "../hooks/hooks.json", "../.mcp.json"]) {
    assert.ok(read(path).length);
  }
});
