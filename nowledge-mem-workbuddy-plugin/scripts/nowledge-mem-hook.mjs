#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { delimiter, extname, join, normalize, resolve } from "node:path";
import { homedir, platform } from "node:os";
import { fileURLToPath } from "node:url";

const SOURCE_APP = "workbuddy";
const DEFAULT_COMMAND_TIMEOUT_MS = 25_000;
const ROUTING_CONTEXT =
  "Nowledge Mem is the user's current cross-tool memory. For continuation, prior decisions, preferences, regressions, or exact history, search Nowledge memories or threads before relying on WorkBuddy-local memory. Use MCP tools when connected; use nmem as the fallback. Save only durable decisions, procedures, preferences, and non-obvious learnings.";

function readPayload() {
  try {
    const raw = readFileSync(0, "utf8");
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    log(`invalid hook payload: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function positiveInt(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isFile(candidate) {
  if (!candidate) return false;
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function executableNames(name) {
  if (platform() !== "win32" || extname(name)) return [name];
  const extensions = (process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  return [name, ...extensions.map((extension) => `${name}${extension.toLowerCase()}`)];
}

function findOnPath(name) {
  if (!name) return null;
  if (name.includes("/") || name.includes("\\")) {
    return isFile(name) ? normalize(name) : null;
  }
  for (const directory of (process.env.PATH || "").split(delimiter)) {
    if (!directory) continue;
    for (const candidateName of executableNames(name)) {
      const candidate = join(directory.replace(/^"|"$/g, ""), candidateName);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

function knownNmemCandidates() {
  const home = homedir();
  if (platform() === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    const appData = process.env.APPDATA || "";
    const programRoots = [
      process.env.PROGRAMFILES,
      process.env.PROGRAMW6432,
      process.env["PROGRAMFILES(X86)"],
    ].filter(Boolean);
    return [
      localAppData && join(localAppData, "Nowledge Mem CLI", "bin", "nmem.cmd"),
      localAppData && join(localAppData, "Programs", "Nowledge Mem", "cli", "nmem.cmd"),
      localAppData && join(localAppData, "Nowledge Mem", "cli", "nmem.cmd"),
      ...programRoots.map((root) => join(root, "Nowledge Mem", "cli", "nmem.cmd")),
      appData && join(appData, "npm", "nmem.cmd"),
    ].filter(Boolean);
  }
  return [
    join(home, ".local", "share", "nowledge-mem", "bin", "nmem-wrapper"),
    "/usr/local/bin/nmem",
    join(home, ".local", "bin", "nmem"),
    "/opt/homebrew/bin/nmem",
    "/usr/bin/nmem",
  ];
}

function findNmem() {
  const configured = (process.env.NMEM_CLI_PATH || "").trim();
  if (configured) {
    const found = findOnPath(configured);
    if (found) return found;
    return null;
  }
  for (const name of ["nmem", "nmem.cmd", "nmem.exe"]) {
    const found = findOnPath(name);
    if (found) return found;
  }
  for (const candidate of knownNmemCandidates()) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function commandFor(nmem, args) {
  if (platform() === "win32" && /\.(cmd|bat)$/i.test(nmem)) {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/v:off", "/s", "/c", "call", nmem, ...args],
    };
  }
  return { command: nmem, args };
}

function runNmem(
  args,
  timeoutMs = positiveInt(
    "NMEM_WORKBUDDY_COMMAND_TIMEOUT_MS",
    DEFAULT_COMMAND_TIMEOUT_MS,
  ),
) {
  const nmem = findNmem();
  if (!nmem) {
    return { ok: false, missing: true, stdout: "", stderr: "nmem was not found" };
  }
  const invocation = commandFor(nmem, args);
  const result = spawnSync(invocation.command, invocation.args, {
    encoding: "utf8",
    windowsHide: true,
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });
  return {
    ok: !result.error && result.status === 0,
    missing: false,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status,
    error: result.error,
  };
}

function compact(value, limit = 600) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function log(message) {
  try {
    const configRoot =
      process.env.WORKBUDDY_CONFIG_DIR ||
      process.env.CODEBUDDY_CONFIG_DIR ||
      join(homedir(), ".workbuddy");
    const pluginData = process.env.CODEBUDDY_PLUGIN_DATA || process.env.CLAUDE_PLUGIN_DATA;
    const logDir = pluginData || join(configRoot, "logs");
    mkdirSync(logDir, { recursive: true });
    appendFileSync(
      join(logDir, "nowledge-mem-hook.log"),
      `${new Date().toISOString()} [${SOURCE_APP}] ${message}\n`,
      "utf8",
    );
  } catch {
    // Hook logging must never affect the host session.
  }
}

function parseJsonOutput(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const first = trimmed.indexOf("{");
    const last = trimmed.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(trimmed.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function contextText(value) {
  if (!value || typeof value !== "object") return "";
  for (const key of ["rendered_markdown", "markdown", "content", "context"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  if (value.data && typeof value.data === "object") return contextText(value.data);
  return "";
}

function allow(extra = {}) {
  process.stdout.write(`${JSON.stringify({ continue: true, suppressOutput: true, ...extra })}\n`);
}

function handleContext(payload) {
  const configuredTimeout = positiveInt(
    "NMEM_WORKBUDDY_COMMAND_TIMEOUT_MS",
    DEFAULT_COMMAND_TIMEOUT_MS,
  );
  const context = runNmem(
    ["--json", "context", "--source-app", SOURCE_APP],
    Math.min(configuredTimeout, 18_000),
  );
  let content = context.ok ? contextText(parseJsonOutput(context.stdout)) : "";

  if (!content) {
    const workingMemory = runNmem(
      ["--json", "wm", "read"],
      Math.min(configuredTimeout, 7_000),
    );
    if (workingMemory.ok) content = contextText(parseJsonOutput(workingMemory.stdout));
    if (!workingMemory.ok && !context.ok) {
      log(
        `startup context unavailable: ${compact(
          context.error?.message || context.stderr || workingMemory.error?.message || workingMemory.stderr,
        )}`,
      );
    }
  }

  if (!content) return allow();
  allow({
    hookSpecificOutput: {
      hookEventName: String(payload.hook_event_name || "SessionStart"),
      additionalContext: content,
    },
  });
}

function handleRoute(payload) {
  allow({
    hookSpecificOutput: {
      hookEventName: String(payload.hook_event_name || "UserPromptSubmit"),
      additionalContext: ROUTING_CONTEXT,
    },
  });
}

export function buildCaptureArgs(sessionId, transcriptPath) {
  return [
    "--json",
    "t",
    "capture",
    "--from",
    SOURCE_APP,
    "--session-id",
    sessionId,
    "--transcript-path",
    transcriptPath,
    "--sync",
    "--all-projects",
  ];
}

function handleSync(payload) {
  const event = String(payload.hook_event_name || "unknown");
  const parentSessionId = String(payload.session_id || payload.sessionId || "").trim();
  const agentId = String(payload.agent_id || payload.agentId || "").trim();
  const sessionId =
    event === "SubagentStop" && agentId ? agentId : parentSessionId;
  const transcriptPath = String(
    payload.agent_transcript_path ||
      payload.agentTranscriptPath ||
      payload.transcript_path ||
      payload.transcriptPath ||
      "",
  ).trim();

  if (!sessionId || !transcriptPath) {
    log(`skip ${event}: missing ${!sessionId ? "session_id" : "transcript_path"}`);
    return allow();
  }
  if (!existsSync(transcriptPath)) {
    log(`skip ${event} ${sessionId}: transcript not found at ${transcriptPath}`);
    return allow();
  }

  let result = runNmem(buildCaptureArgs(sessionId, transcriptPath), 5_000);
  let queued = result.ok;
  if (!result.ok) {
    // Compatibility path for an older nmem binary without `t capture`.
    result = runNmem([
      "--json",
      "t",
      "sync",
      "--from",
      SOURCE_APP,
      "--session-id",
      sessionId,
      "--session-dir",
      transcriptPath,
      "--all-projects",
      "--apply",
    ]);
    queued = false;
  }
  if (result.ok) {
    const parentSuffix =
      event === "SubagentStop" && parentSessionId && parentSessionId !== sessionId
        ? ` parent=${parentSessionId}`
        : "";
    log(`${queued ? "queued" : "synced"} ${event} ${sessionId}${parentSuffix} from ${transcriptPath}`);
  } else {
    log(
      `sync failed ${event} ${sessionId} exit=${result.status ?? "spawn"} error=${compact(
        result.error?.message || result.stderr || result.stdout,
      )}`,
    );
  }
  allow();
}

function main() {
  const payload = readPayload();
  switch (process.argv[2]) {
    case "context":
      handleContext(payload);
      break;
    case "route":
      handleRoute(payload);
      break;
    case "sync":
      handleSync(payload);
      break;
    default:
      log(`unknown hook mode: ${process.argv[2] || "<missing>"}`);
      allow();
  }
}

const entrypoint = process.argv[1] ? realpathSync(resolve(process.argv[1])) : "";
if (realpathSync(fileURLToPath(import.meta.url)) === entrypoint) {
  main();
}
