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
  "hooks/nmem-context.py",
  "hooks/nmem_runtime.py",
  "hooks/nmem-stop-launch.py",
  "hooks/nmem-stop-save.py",
  "hooks/skill_outcome.py",
  "scripts/install_hooks.py",
  "scripts/validate-plugin.mjs",
  "skills/working-memory/SKILL.md",
  "skills/search-memory/SKILL.md",
  "skills/save-thread/SKILL.md",
  "skills/save-thread/scripts/save_thread.sh",
  "skills/save-thread/scripts/save_thread.ps1",
  "skills/distill-memory/SKILL.md",
  "skills/explore-graph/SKILL.md",
  "skills/status/SKILL.md",
]) {
  requireFile(file);
}

const exploreGraphSkill = readTextIfPresent(
  path.join(pluginRoot, "skills/explore-graph/SKILL.md"),
  "skills/explore-graph/SKILL.md",
);
if (exploreGraphSkill) {
  for (const requiredText of [
    "name: explore-graph",
    "Trigger only when",
    "nmem --json status",
    "/graph/vis?standalone=1",
    "Never put an API key in a URL.",
    "Routine memory searches stay",
  ]) {
    if (!exploreGraphSkill.includes(requiredText)) {
      fail(`explore-graph skill must include: ${requiredText}`);
    }
  }
  ok("explore-graph explicit activation contract");
}

const manifest = parseJsonIfPresent(
  path.join(pluginRoot, ".codex-plugin/plugin.json"),
  ".codex-plugin/plugin.json",
);
const expectedVersion = manifest?.version;
if (manifest) {
  if (manifest.name !== "nowledge-mem") fail(`unexpected plugin name: ${manifest.name}`);
  else ok("plugin manifest name");
  if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
    fail(`invalid plugin version: ${manifest.version}`);
  }
  else ok("plugin manifest version");
  if (manifest.hooks !== "./hooks/hooks.json") fail("manifest must declare ./hooks/hooks.json");
  else ok("plugin manifest hooks");
  if (manifest.mcpServers !== "./.mcp.json") fail("manifest must declare ./.mcp.json");
  else ok("plugin manifest MCP");
}

const hooks = parseJsonIfPresent(path.join(pluginRoot, "hooks/hooks.json"), "hooks/hooks.json");
if (hooks) {
  const hookTopLevelKeys = Object.keys(hooks).sort();
  if (hookTopLevelKeys.length !== 1 || hookTopLevelKeys[0] !== "hooks") {
    fail("hooks/hooks.json must only contain the top-level hooks key");
  } else ok("hooks/hooks.json strict top-level schema");
  const stopHooks = hooks.hooks?.Stop;
  const sessionStartHooks = hooks.hooks?.SessionStart;
  const subagentStartHooks = hooks.hooks?.SubagentStart;
  const promptHooks = hooks.hooks?.UserPromptSubmit;
  if (!Array.isArray(sessionStartHooks)) fail("hooks/hooks.json must declare SessionStart hooks");
  else if (!JSON.stringify(sessionStartHooks).includes("nmem-context.py")) fail("SessionStart must load Nowledge context");
  else if (!sessionStartHooks[0]?.hooks?.[0]?.commandWindows?.startsWith("py -3 -c ")) fail("SessionStart Windows hook must prefer py -3");
  else ok("SessionStart context injection");
  if (!Array.isArray(subagentStartHooks)) fail("hooks/hooks.json must declare SubagentStart hooks");
  else if (!JSON.stringify(subagentStartHooks).includes("nmem-context.py")) fail("SubagentStart must run selective Nowledge bootstrap");
  else if (!subagentStartHooks[0]?.hooks?.[0]?.commandWindows?.startsWith("py -3 -c ")) fail("SubagentStart Windows hook must prefer py -3");
  else ok("SubagentStart selective bootstrap");
  if (!Array.isArray(promptHooks)) fail("hooks/hooks.json must declare UserPromptSubmit hooks");
  else if (!JSON.stringify(promptHooks).includes("nmem-context.py")) fail("UserPromptSubmit must inject memory routing");
  else if (!promptHooks[0]?.hooks?.[0]?.commandWindows?.startsWith("py -3 -c ")) fail("UserPromptSubmit Windows hook must prefer py -3");
  else ok("UserPromptSubmit memory routing");
  if (!Array.isArray(stopHooks)) fail("hooks/hooks.json must declare Stop hooks");
  else {
    const commands = [];
    const windowsCommands = [];
    const collectCommands = (value) => {
      if (Array.isArray(value)) {
        for (const item of value) collectCommands(item);
        return;
      }
      if (value && typeof value === "object") {
        if (typeof value.command === "string") commands.push(value.command);
        if (typeof value.commandWindows === "string") {
          commands.push(value.commandWindows);
          windowsCommands.push(value.commandWindows);
        }
        for (const item of Object.values(value)) collectCommands(item);
      }
    };
    collectCommands(stopHooks);
    if (!commands.some((command) => command.includes("nmem-stop-launch.py"))) {
      fail("Stop hooks must run nmem-stop-launch.py");
    } else ok("Stop hook capture");
    if (!commands.some((command) => command.includes("os.environ['PLUGIN_ROOT']"))) {
      fail("Stop hook commands must read PLUGIN_ROOT from Python, not shell expansion");
    } else ok("Stop hook launcher env lookup");
    if (commands.some((command) => command.includes("${PLUGIN_ROOT}"))) {
      fail("Stop hook commands must not rely on ${PLUGIN_ROOT} placeholder expansion");
    } else ok("Stop hook command avoids Codex placeholder dependency");
    if (commands.some((command) => command.includes("%PLUGIN_ROOT%"))) {
      fail("Stop hook commands must not rely on %PLUGIN_ROOT% shell expansion");
    } else ok("Stop hook command avoids Windows shell env expansion");
    if (!commands.some((command) => command.includes("python3 -c \"import os, runpy, sys"))) {
      fail("Stop hook generic command must keep the POSIX python3 launcher first");
    } else ok("Stop hook POSIX Python launcher");
    if (!commands.some((command) => command.includes("python -c \"import os, runpy, sys"))) {
      fail("Stop hook generic command must include a python fallback");
    } else ok("Stop hook generic python fallback");
    if (commands.some((command) => command.includes("if ["))) {
      fail("Stop hook command must not use Bash-only conditionals");
    } else ok("Stop hook generic command is shell-neutral");
    if (commands.some((command) => command.includes("$HOME/.codex/hooks/nowledge-mem-stop-save.py"))) {
      fail("Stop hook command must not branch on $HOME in shell");
    } else ok("Stop hook stable fallback lives in launcher");
    if (!windowsCommands.some((command) => command.includes("python -c \"import os, runpy, sys"))) {
      fail("Stop hook must declare a Windows command using python");
    } else ok("Stop hook Windows Python launcher");
    if (!windowsCommands.some((command) => command.includes("py -3 -c \"import os, runpy, sys"))) {
      fail("Stop hook must declare a Windows py launcher fallback");
    } else ok("Stop hook Windows py fallback");
    if (!windowsCommands.some((command) => command.startsWith("py -3 -c "))) {
      fail("Stop hook Windows command must prefer the Python launcher over Store aliases");
    } else ok("Stop hook Windows launcher order");
    if (!windowsCommands.some((command) => command.includes("python3 -c \"import os, runpy, sys"))) {
      fail("Stop hook must declare a Windows python3 fallback");
    } else ok("Stop hook Windows python3 fallback");
  }
}

const changelog = readTextIfPresent(path.join(pluginRoot, "CHANGELOG.md"), "CHANGELOG.md");
if (changelog !== null) {
  if (!expectedVersion || !changelog.includes(`## [${expectedVersion}]`)) fail(`CHANGELOG must contain a ${expectedVersion} entry`);
  else ok("CHANGELOG version entry");
}

const hookRuntime = readTextIfPresent(path.join(pluginRoot, "hooks/nmem-stop-save.py"), "hooks/nmem-stop-save.py");
if (hookRuntime !== null) {
  if (!hookRuntime.includes("def _claim_capture_event")) fail("Stop hook runtime must guard duplicate hook sources");
  else ok("Stop hook duplicate guard");
  if (!hookRuntime.includes("def _write_hook_response")) fail("Stop hook runtime must emit a Codex JSON response");
  else ok("Stop hook JSON response");
}

const hookLauncher = readTextIfPresent(path.join(pluginRoot, "hooks/nmem-stop-launch.py"), "hooks/nmem-stop-launch.py");
if (hookLauncher !== null) {
  if (!hookLauncher.includes("runpy.run_path")) fail("Stop hook launcher must delegate with runpy.run_path");
  else ok("Stop hook launcher delegation");
  const packagedSelection = hookLauncher.indexOf("hook = _packaged_hook()");
  const stableSelection = hookLauncher.indexOf("hook = _stable_host_hook()");
  if (packagedSelection < 0 || stableSelection < 0 || packagedSelection >= stableSelection) {
    fail("Stop hook launcher must prefer the packaged hook and use the stable hook only as fallback");
  } else {
    ok("Stop hook launcher packaged-first fallback order");
  }
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
