// Generated from src/index.ts. Run npm run build before publishing.

// src/index.ts
import { tool } from "@opencode-ai/plugin";
import { existsSync as existsSync2, readFileSync as readFileSync2 } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// src/cli-runner.mjs
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
var MAX_OUTPUT_BYTES = 64 * 1024 * 1024;
function createNmemCliRunner(shell, execFileImpl = execFile, { platform = process.platform, readFileImpl = readFileSync, existsImpl = existsSync } = {}) {
  if (typeof shell === "function") {
    return async (args) => shell`nmem --json ${args}`.text();
  }
  let commandPromise;
  const command = async () => {
    if (platform !== "win32") return "nmem";
    commandPromise ??= resolveWindowsNmemExecutable(execFileImpl, readFileImpl, existsImpl);
    return commandPromise;
  };
  return async (args) => {
    const executable = await command();
    if (!executable) {
      const error = new Error("nmem CLI executable was not found");
      error.code = "ENOENT";
      throw error;
    }
    return new Promise((resolve, reject) => {
      execFileImpl(
        executable,
        ["--json", ...args],
        { encoding: "utf8", maxBuffer: MAX_OUTPUT_BYTES },
        (error, stdout, stderr) => {
          if (error) {
            error.stderr = String(stderr ?? "");
            reject(error);
            return;
          }
          resolve(String(stdout ?? ""));
        }
      );
    });
  };
}
function runExecFile(execFileImpl, file, args, options) {
  return new Promise((resolve) => {
    execFileImpl(file, args, options, (error, stdout, stderr) => {
      resolve({ error, stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}
async function resolveWindowsNmemExecutable(execFileImpl, readFileImpl, existsImpl) {
  const whereOptions = { encoding: "utf8", maxBuffer: 64 * 1024 };
  const direct = await runExecFile(execFileImpl, "where.exe", ["nmem.exe"], whereOptions);
  if (!direct.error) {
    const directPath = direct.stdout.split(/\r?\n/).map((line) => line.trim()).find((line) => line && existsImpl(line));
    if (directPath) return directPath;
  }
  const wrapper = await runExecFile(execFileImpl, "where.exe", ["nmem.cmd"], whereOptions);
  if (wrapper.error) return null;
  for (const candidate of wrapper.stdout.split(/\r?\n/).map((line) => line.trim())) {
    if (!candidate) continue;
    let contents;
    try {
      contents = readFileImpl(candidate, "utf8");
    } catch {
      continue;
    }
    const match = contents.match(/^\s*"([^"\r\n]+\.exe)"\s+%\*\s*$/m);
    if (match?.[1] && existsImpl(match[1])) return match[1];
  }
  return null;
}

// src/session-delta.ts
import { createHash } from "node:crypto";
function sessionSyncLaneKey(sessionId, apiUrl, apiKey, spaceId, agentId, hostAgentId) {
  const destination = createHash("sha256").update([apiUrl, apiKey ?? "", spaceId ?? "", agentId ?? "", hostAgentId ?? ""].join("\0")).digest("hex");
  return `${destination}\0${sessionId}`;
}
function stableMessageFingerprint(message) {
  return JSON.stringify(message);
}
function normalizedTimestamp(raw) {
  if (raw === null || raw === void 0) return void 0;
  try {
    const timestamp = new Date(raw);
    return Number.isNaN(timestamp.getTime()) ? void 0 : timestamp.toISOString();
  } catch {
    return void 0;
  }
}
function prefixFingerprint(messages, end, messageFingerprint) {
  const hash = createHash("sha256");
  for (const message of messages.slice(0, end)) {
    const value = messageFingerprint(message);
    hash.update(String(Buffer.byteLength(value)));
    hash.update(":");
    hash.update(value);
  }
  return hash.digest("hex");
}
function isThreadNotFoundResponse(status, data) {
  if (typeof data === "object" && data !== null && data.error_code === "thread_not_found") return true;
  if (status === 404) return true;
  return JSON.stringify(data).toLowerCase().includes("thread not found");
}
function isThreadAlreadyExistsResponse(status, data) {
  if (status === 409) return true;
  const text = JSON.stringify(data).toLowerCase();
  return text.includes("thread already exists") || text.includes("already exists in space");
}
function isCheckpointConflictResponse(data) {
  return typeof data === "object" && data !== null && data.error_code === "checkpoint_conflict";
}
function isCheckpointedAppendAck(data) {
  return typeof data === "object" && data !== null && data.success === true && Number.isInteger(data.messages_added) && Number.isInteger(data.total_messages) && data.append_mode === "checkpointed";
}
function appendAcknowledgedRemoteCount(data) {
  if (typeof data !== "object" || data === null || data.success !== true || !Number.isInteger(data.messages_added) || !Number.isInteger(data.total_messages)) return void 0;
  return data.total_messages;
}
function createAcknowledgedRemoteCount(data, expectedThreadId) {
  if (typeof data !== "object" || data === null) return void 0;
  const thread = data.thread;
  if (typeof thread !== "object" || thread === null) return void 0;
  if (thread.thread_id !== expectedThreadId) return void 0;
  const messageCount = thread.message_count;
  if (Number.isInteger(messageCount) && messageCount >= 0) {
    return messageCount;
  }
  const messages = data.messages;
  return Array.isArray(messages) ? messages.length : void 0;
}
async function recreateMissingThread(response, recreate) {
  if (response.ok || !isThreadNotFoundResponse(response.status, response.data)) {
    return { response, recreated: false };
  }
  return { response: await recreate(), recreated: true };
}
function selectAcknowledgedDelta(messages, cursor, externalId, messageFingerprint = stableMessageFingerprint) {
  let start = cursor?.count ?? 0;
  let reset = false;
  const acknowledgedPrefix = start >= 0 && start <= messages.length ? prefixFingerprint(messages, start, messageFingerprint) : "";
  if (start < 0 || start > messages.length || start > 0 && (externalId(messages[start - 1]) !== cursor?.lastExternalId || acknowledgedPrefix !== cursor?.prefixFingerprint)) {
    start = 0;
    reset = true;
  }
  const end = messages.length;
  return {
    start,
    end,
    messages: messages.slice(start),
    next: {
      count: end,
      remoteCount: cursor?.remoteCount ?? end,
      ...end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {},
      prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint)
    },
    reset
  };
}

// src/thread-sync-timeout.ts
var DEFAULT_THREAD_SYNC_TIMEOUT_MS = 12e4;
var MIN_THREAD_SYNC_TIMEOUT_MS = 1e3;
var MAX_THREAD_SYNC_TIMEOUT_MS = 30 * 6e4;
function resolveThreadSyncTimeoutMs(raw) {
  const parsed = Number(raw);
  if (!raw?.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_THREAD_SYNC_TIMEOUT_MS;
  }
  return Math.min(MAX_THREAD_SYNC_TIMEOUT_MS, Math.max(MIN_THREAD_SYNC_TIMEOUT_MS, parsed));
}

// src/index.ts
var THREAD_SYNC_TIMEOUT_MS = resolveThreadSyncTimeoutMs(process.env.NMEM_SYNC_TIMEOUT_MS);
var BEHAVIORAL_GUIDANCE = `## Nowledge Mem

You have Nowledge Mem tools for cross-tool knowledge management. Use them proactively.

**At session start:** Call \`nowledge_mem_context_bundle\` when identity, scope, or rules may matter. It includes Working Memory, owner identity, AI Identity, active space, and the active rules. Use \`nowledge_mem_working_memory\` only for a lightweight daily briefing or fallback. Reference relevant parts naturally as the conversation progresses.

**Space routing:** If the user names a Nowledge Space, pass \`space\` or \`space_id\` on the relevant tool call. Prefer \`space_id\` after checking \`nmem --json spaces list\`; otherwise pass the exact Space name as \`space\`. Do not rely on the ambient default when the user explicitly asks for a different Space.

**When to search (\`nowledge_mem_search\`):**
- The user references previous work, a prior fix, or an earlier decision
- The task resumes a named feature, bug, refactor, or subsystem
- A debugging pattern resembles something solved earlier
- The user asks for rationale, preferences, procedures, or recurring workflow details
- The user uses recall language: "that approach", "like before", "the pattern we used"

**When to save or update:**
Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked. Search first to check for related memories:
- If a related memory exists, call \`nowledge_mem_update\` to refine it
- If genuinely new, call \`nowledge_mem_save\`

**When to search threads (\`nowledge_mem_thread_search\`):**
- The user asks about a prior conversation or exact session history
- A memory result references a source thread

**When to save the session (\`nowledge_mem_save_thread\`):**
- The user asks to save the conversation or "remember this session"
- A long productive session is wrapping up
- The conversation produced decisions or context worth preserving as a full thread
`;
var index_default = {
  id: "nowledge-mem",
  server: async (input) => {
    const { $, client, directory } = input;
    const runNmemCli = createNmemCliRunner($);
    async function nmem(args) {
      try {
        const result = await runNmemCli(withAmbientSpaceArg(args));
        return result.trim();
      } catch (err) {
        const stderr = String(err?.stderr ?? "");
        if (err?.code === "ENOENT" || stderr.includes("command not found") || stderr.includes("not recognized")) {
          return JSON.stringify({
            error: "nmem CLI not found. Install it from Nowledge Mem: Settings > Developer Tools > Install CLI, or run: pip install nmem-cli"
          });
        }
        return JSON.stringify({ error: stderr || String(err) });
      }
    }
    function isNmemErrorPayload(output) {
      try {
        const parsed = JSON.parse(output);
        return parsed && typeof parsed === "object" && "error" in parsed;
      } catch {
        return false;
      }
    }
    function readSharedConfig() {
      const path = join(homedir(), ".nowledge-mem", "config.json");
      try {
        if (!existsSync2(path)) return {};
        const parsed = JSON.parse(readFileSync2(path, "utf8"));
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }
    function stringConfigValue(value) {
      return typeof value === "string" ? value.trim() || void 0 : void 0;
    }
    function withAmbientSpaceArg(args) {
      let next = args;
      if (ambientSpaceId && !next.includes("--space") && !next.includes("--space-id")) {
        const scopedCommands = /* @__PURE__ */ new Set(["context", "ctx", "wm", "m", "memories", "t", "threads"]);
        if (scopedCommands.has(next[0] ?? "")) {
          next = [...next, "--space", ambientSpaceId];
        }
      }
      if (next[0] !== "context" && next[0] !== "ctx") return next;
      if (ambientAgentId && !next.includes("--agent-id")) {
        next = [...next, "--agent-id", ambientAgentId];
      }
      if (ambientHostAgentId && !next.includes("--host-agent-id")) {
        next = [...next, "--host-agent-id", ambientHostAgentId];
      }
      return next;
    }
    function readEnvOrConfig(...keys) {
      for (const key of keys) {
        const envValue = process.env[key]?.trim();
        if (envValue) return envValue;
      }
      for (const key of keys) {
        const configValue = stringConfigValue(sharedConfig[key]);
        if (configValue) return configValue;
      }
      return void 0;
    }
    const sharedConfig = readSharedConfig();
    const apiUrl = (process.env.NMEM_API_URL?.trim() || stringConfigValue(sharedConfig.apiUrl) || "http://127.0.0.1:14242").replace(/\/+$/, "");
    const apiKey = process.env.NMEM_API_KEY?.trim() || stringConfigValue(sharedConfig.apiKey);
    const ambientSpaceId = process.env.NMEM_SPACE?.trim() || process.env.NMEM_SPACE_ID?.trim() || stringConfigValue(sharedConfig.space) || stringConfigValue(sharedConfig.spaceId) || stringConfigValue(sharedConfig.space_id);
    const ambientAgentId = readEnvOrConfig("NMEM_AGENT_ID", "agentId", "agent_id");
    const ambientHostAgentId = readEnvOrConfig("NMEM_HOST_AGENT_ID", "hostAgentId", "host_agent_id");
    function withAmbientSpace(body) {
      if (!ambientSpaceId || body == null || typeof body !== "object" || Array.isArray(body)) {
        return body;
      }
      if ("space_id" in body) {
        return body;
      }
      return { ...body, space_id: ambientSpaceId };
    }
    function stringToolValue(value) {
      return typeof value === "string" ? value.trim() || void 0 : void 0;
    }
    function explicitSpaceForCli(args) {
      const spaceId = stringToolValue(args.space_id);
      if (spaceId) return ["--space-id", spaceId];
      const space = stringToolValue(args.space);
      return space ? ["--space", space] : [];
    }
    function explicitSpaceForHttp(args) {
      return stringToolValue(args.space_id) || stringToolValue(args.space);
    }
    function withExplicitSpaceArg(cmd, args) {
      return [...cmd, ...explicitSpaceForCli(args)];
    }
    function spaceToolArgs() {
      return {
        space: tool.schema.string().optional().describe("Optional Nowledge Space name or alias for this one call"),
        space_id: tool.schema.string().optional().describe("Optional Nowledge Space id/key for this one call; takes priority over space")
      };
    }
    async function nmemApi(path, body, timeoutMs = 3e4) {
      const headers = { "Content-Type": "application/json" };
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["X-NMEM-API-Key"] = apiKey;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(withAmbientSpace(body)),
          signal: controller.signal
        });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
      } catch (err) {
        if (err.name === "AbortError") {
          return { ok: false, status: 504, data: { error: `Request timed out after ${Math.round(timeoutMs / 1e3)}s` } };
        }
        return { ok: false, status: 0, data: { error: err.message } };
      } finally {
        clearTimeout(timeout);
      }
    }
    function extractMessageContent(parts) {
      const segments = [];
      for (const part of parts) {
        switch (part.type) {
          case "text": {
            const text = part.content || part.text;
            if (text) segments.push(text);
            break;
          }
          case "tool": {
            const name = part.tool ?? part.name ?? "unknown";
            const status = part.state === "error" ? " (failed)" : "";
            segments.push(`[Tool: ${name}${status}]`);
            break;
          }
          case "reasoning": {
            const reasoning = part.content || part.text;
            if (reasoning) segments.push(`<thinking>
${reasoning}
</thinking>`);
            break;
          }
          case "file":
            segments.push(`[File: ${part.filename ?? part.path ?? "attachment"}]`);
            break;
          case "patch":
            segments.push(`[Patch: ${part.path ?? "file change"}]`);
            break;
        }
      }
      return segments.join("\n") || "(empty message)";
    }
    function toThreadMessages(sdkMessages) {
      return sdkMessages.filter((m) => m?.info).map(({ info, parts }) => {
        const timestamp = normalizedTimestamp(info.time?.created);
        return {
          content: extractMessageContent(parts ?? []),
          role: info.role === "user" ? "user" : "assistant",
          ...timestamp ? { timestamp } : {},
          metadata: {
            external_id: `opencode-msg-${info.id}`,
            source_app: "opencode",
            ...info.agent ? { agent: info.agent } : {},
            ...info.role === "assistant" && info.modelID ? { model: info.modelID } : {}
          }
        };
      });
    }
    function normalizeSessionMessages(raw) {
      if (Array.isArray(raw)) return raw;
      if (Array.isArray(raw?.data)) return raw.data;
      if (Array.isArray(raw?.items)) return raw.items;
      if (Array.isArray(raw?.messages)) return raw.messages;
      return [];
    }
    async function fetchSessionMessages(ctx) {
      const attempts = [
        {
          path: { id: ctx.sessionID },
          query: ctx.directory ? { directory: ctx.directory } : void 0
        },
        { sessionID: ctx.sessionID }
      ];
      let lastError;
      for (const options of attempts) {
        try {
          const messages = normalizeSessionMessages(await client.session.messages(options));
          if (messages.length > 0) return messages;
        } catch (error) {
          lastError = error;
        }
      }
      if (lastError) {
        console.warn(
          `[nowledge-mem] failed to read OpenCode session messages for ${ctx.sessionID}:`,
          lastError instanceof Error ? lastError.message : lastError
        );
      }
      return [];
    }
    const syncStates = /* @__PURE__ */ new Map();
    const autoSyncDebounceMs = Math.max(
      250,
      Number(process.env.NMEM_OPENCODE_AUTO_SYNC_DEBOUNCE_MS ?? "1500") || 1500
    );
    const autoSyncEnabled = !["0", "false", "off", "no"].includes(
      (process.env.NMEM_OPENCODE_AUTO_SYNC ?? "1").trim().toLowerCase()
    );
    function syncStateFor(sessionID, spaceId = ambientSpaceId) {
      const key = sessionSyncLaneKey(
        sessionID,
        apiUrl,
        apiKey,
        spaceId,
        ambientAgentId,
        ambientHostAgentId
      );
      const existing = syncStates.get(key);
      if (existing) return existing;
      const created = {};
      syncStates.set(key, created);
      return created;
    }
    function lastExternalId(messages) {
      for (let i = messages.length - 1; i >= 0; i -= 1) {
        const id = messages[i]?.metadata?.external_id;
        if (typeof id === "string" && id) return id;
      }
      return "";
    }
    function threadMetadata(sessionID, reason) {
      return {
        opencode_session_id: sessionID,
        source_app: "opencode",
        sync_reason: reason,
        live_capture: reason !== "manual_tool",
        ...ambientAgentId ? { agent_id: ambientAgentId } : {},
        ...ambientHostAgentId ? { host_agent_id: ambientHostAgentId } : {}
      };
    }
    async function mergeThreadMetadata(threadId, metadata, timeoutMs) {
      await nmemApi(
        `/threads/${encodeURIComponent(threadId)}/metadata/merge`,
        { metadata, only_missing: true },
        timeoutMs
      );
    }
    async function syncSessionThread(ctx, options) {
      if (!ctx.sessionID) {
        return { error: "No session ID available. Use nowledge_mem_save_handoff instead." };
      }
      const timeoutMs = options.timeoutMs ?? 3e4;
      const sdkMessages = await fetchSessionMessages({
        ...ctx,
        directory: ctx.directory ?? directory
      });
      if (!sdkMessages || sdkMessages.length === 0) {
        return { skipped: true, reason: "no_messages", session_id: ctx.sessionID };
      }
      const threadMessages = toThreadMessages(sdkMessages);
      if (threadMessages.length === 0) {
        return { skipped: true, reason: "no_extractable_messages", session_id: ctx.sessionID };
      }
      const hasUser = threadMessages.some((message) => message.role === "user");
      const hasAssistant = threadMessages.some((message) => message.role === "assistant");
      if (!hasUser || !hasAssistant) {
        return { skipped: true, reason: "incomplete_turn", session_id: ctx.sessionID };
      }
      const state = syncStateFor(ctx.sessionID, options.spaceId || ambientSpaceId);
      const delta = selectAcknowledgedDelta(
        threadMessages,
        options.force ? void 0 : state.acknowledged,
        (message) => String(message?.metadata?.external_id ?? ""),
        stableMessageFingerprint
      );
      if (delta.messages.length === 0) {
        return { skipped: true, reason: "already_synced", session_id: ctx.sessionID };
      }
      const threadId = `opencode-${ctx.sessionID}`.toLowerCase();
      const title = options.summary || threadMessages.find((message) => message.role === "user")?.content?.slice(0, 120) || threadMessages[0]?.content?.slice(0, 120) || "OpenCode Session";
      const metadata = threadMetadata(ctx.sessionID, options.reason);
      const projectPath = ctx.directory ?? directory;
      const createBody = {
        thread_id: threadId,
        title,
        messages: threadMessages,
        source: "opencode",
        project: projectPath,
        workspace: projectPath,
        ...options.spaceId ? { space_id: options.spaceId } : {},
        metadata
      };
      let res = state.created ? { ok: false, status: 409, data: null } : await nmemApi("/threads", createBody, timeoutMs);
      let action = state.created ? "appended" : "created";
      let checkpointed = false;
      let persistedMessages = delta.messages.length;
      if (!res.ok && isThreadAlreadyExistsResponse(res.status, res.data)) {
        state.created = true;
        await mergeThreadMetadata(threadId, metadata, timeoutMs).catch(() => void 0);
        res = await nmemApi(
          `/threads/${encodeURIComponent(threadId)}/append`,
          {
            messages: delta.messages,
            deduplicate: true,
            idempotency_key: `opencode:live:${ctx.sessionID}:${delta.start}-${delta.end}:${delta.next.prefixFingerprint}`,
            ...state.acknowledged && !delta.reset ? { expected_message_count: state.acknowledged.remoteCount } : {},
            ...options.spaceId ? { space_id: options.spaceId } : ambientSpaceId ? { space_id: ambientSpaceId } : {}
          },
          timeoutMs
        );
        checkpointed = Boolean(state.acknowledged && !delta.reset);
        action = "appended";
      }
      if (!res.ok && checkpointed && isCheckpointConflictResponse(res.data)) {
        res = await nmemApi(
          `/threads/${encodeURIComponent(threadId)}/append`,
          {
            messages: threadMessages,
            deduplicate: true,
            idempotency_key: `opencode:reconcile:${ctx.sessionID}:${delta.next.prefixFingerprint}`,
            ...options.spaceId ? { space_id: options.spaceId } : ambientSpaceId ? { space_id: ambientSpaceId } : {}
          },
          timeoutMs
        );
        checkpointed = false;
        persistedMessages = threadMessages.length;
        action = "reconciled";
      }
      const recovered = await recreateMissingThread(res, async () => {
        state.created = false;
        return nmemApi("/threads", createBody, timeoutMs);
      });
      if (recovered.recreated) {
        res = recovered.response;
        action = "created";
        checkpointed = false;
        persistedMessages = threadMessages.length;
      }
      if (!res.ok) {
        return {
          error: `Thread save failed (${res.status}): ${JSON.stringify(res.data)}`,
          thread_id: threadId,
          session_id: ctx.sessionID
        };
      }
      const remoteCount = action === "created" ? createAcknowledgedRemoteCount(res.data, threadId) : appendAcknowledgedRemoteCount(res.data);
      if (remoteCount === void 0) {
        return {
          error: "Thread save did not include an explicit persistence acknowledgement; cursor was preserved",
          thread_id: threadId,
          session_id: ctx.sessionID
        };
      }
      if (checkpointed && !isCheckpointedAppendAck(res.data)) {
        return {
          error: "Thread append was not acknowledged as checkpointed; cursor was preserved",
          thread_id: threadId,
          session_id: ctx.sessionID
        };
      }
      state.created = true;
      state.acknowledged = { ...delta.next, remoteCount };
      return {
        success: true,
        action,
        thread_id: threadId,
        messages_saved: persistedMessages,
        checkpoint_reset: delta.reset,
        title,
        sync_reason: options.reason
      };
    }
    function scheduleAutoThreadSync(sessionID, reason) {
      if (!autoSyncEnabled) return;
      const state = syncStateFor(sessionID);
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.timer = void 0;
        void runAutoThreadSync(sessionID, reason);
      }, autoSyncDebounceMs);
    }
    async function runAutoThreadSync(sessionID, reason) {
      const state = syncStateFor(sessionID);
      if (state.inFlight) {
        state.pending = true;
        return;
      }
      state.inFlight = syncSessionThread(
        { sessionID, directory },
        { reason, force: false, timeoutMs: THREAD_SYNC_TIMEOUT_MS }
      ).then((result) => {
        if ("error" in result) {
          console.warn("[nowledge-mem] automatic OpenCode thread sync failed:", result.error);
        }
      }).catch((err) => {
        console.warn("[nowledge-mem] automatic OpenCode thread sync failed:", err?.message ?? err);
      }).finally(() => {
        state.inFlight = void 0;
        if (state.pending) {
          state.pending = false;
          scheduleAutoThreadSync(sessionID, reason);
        }
      });
      await state.inFlight;
    }
    function sessionIdFromEvent(event) {
      const props = event?.properties ?? {};
      const sessionID = props.sessionID ?? props.sessionId ?? props.session?.id;
      return typeof sessionID === "string" && sessionID ? sessionID : void 0;
    }
    return {
      dispose: async () => {
        for (const state of syncStates.values()) {
          if (state.timer) clearTimeout(state.timer);
        }
        syncStates.clear();
      },
      tool: {
        nowledge_mem_context_bundle: tool({
          description: "Read Nowledge Mem's startup Context Bundle: owner identity, resolved AI Identity, active scope, active rules, Working Memory, and KFS paths. Call this near session start when behavior, identity, or scope matters.",
          args: {
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            const bundle = await nmem(withExplicitSpaceArg(["context", "--source-app", "opencode"], args));
            if (isNmemErrorPayload(bundle)) {
              return await nmem(withExplicitSpaceArg(["wm", "read"], args));
            }
            return bundle;
          }
        }),
        nowledge_mem_working_memory: tool({
          description: "Read today's lightweight Working Memory briefing from Nowledge Mem: current focus areas, priorities, recent decisions, and open questions across all your AI tools. Use nowledge_mem_context_bundle for full startup identity/scope/rules context.",
          args: {
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            return await nmem(withExplicitSpaceArg(["wm", "read"], args));
          }
        }),
        nowledge_mem_search: tool({
          description: "Search the user's knowledge graph for past decisions, procedures, learnings, and context. Returns results from memories saved across all tools (Claude Code, Cursor, Gemini, ChatGPT, etc.). Search proactively when work connects to prior context.",
          args: {
            query: tool.schema.string().describe("Natural language search query"),
            limit: tool.schema.number().optional().describe("Max results to return (default 5, max 20)"),
            label: tool.schema.string().optional().describe("Filter by label name"),
            mode: tool.schema.enum(["default", "deep"]).optional().describe(
              "Search mode: 'default' for fast hybrid, 'deep' for broader conceptual matching"
            ),
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            const cmd = ["m", "search", args.query];
            if (args.limit) cmd.push("-n", String(Math.min(20, Math.max(1, args.limit))));
            if (args.label) cmd.push("-l", args.label);
            if (args.mode === "deep") cmd.push("--mode", "deep");
            return await nmem(withExplicitSpaceArg(cmd, args));
          }
        }),
        nowledge_mem_save: tool({
          description: "Save a decision, insight, procedure, or preference to Nowledge Mem so any future session in any tool can find it. Search first to check if a related memory already exists; if so, use nowledge_mem_update instead.",
          args: {
            content: tool.schema.string().describe("The knowledge to save. Be specific: what was decided and why."),
            title: tool.schema.string().describe("Short descriptive title for this memory"),
            unit_type: tool.schema.enum([
              "fact",
              "preference",
              "decision",
              "plan",
              "procedure",
              "learning",
              "context",
              "event"
            ]).optional().describe("Type of knowledge (default: 'decision')"),
            labels: tool.schema.string().optional().describe("Comma-separated labels for categorization"),
            importance: tool.schema.number().optional().describe(
              "0.0-1.0 importance score. 0.8-1.0: major decisions. 0.5-0.7: useful patterns. 0.3-0.4: minor notes."
            ),
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            const cmd = ["m", "add", args.content, "-t", args.title, "--source", "opencode"];
            if (args.unit_type) cmd.push("--unit-type", args.unit_type);
            if (args.labels) {
              for (const label of args.labels.split(",").map((l) => l.trim())) {
                if (label) cmd.push("-l", label);
              }
            }
            if (args.importance != null) cmd.push("-i", String(args.importance));
            return await nmem(withExplicitSpaceArg(cmd, args));
          }
        }),
        nowledge_mem_update: tool({
          description: "Update an existing memory with new or refined information. Use this instead of creating a duplicate when the new information extends or corrects an existing memory.",
          args: {
            memory_id: tool.schema.string().describe("ID of the memory to update"),
            content: tool.schema.string().optional().describe("Updated content"),
            title: tool.schema.string().optional().describe("Updated title"),
            importance: tool.schema.number().optional().describe("Updated importance score"),
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            const cmd = ["m", "update", args.memory_id];
            if (args.content) cmd.push("-c", args.content);
            if (args.title) cmd.push("-t", args.title);
            if (args.importance != null) cmd.push("-i", String(args.importance));
            return await nmem(withExplicitSpaceArg(cmd, args));
          }
        }),
        nowledge_mem_thread_search: tool({
          description: "Search past conversations from any tool (Claude Code, ChatGPT, Cursor, etc.). Use when the user asks about a prior discussion or exact conversation history.",
          args: {
            query: tool.schema.string().describe("Search query for past conversations"),
            limit: tool.schema.number().optional().describe("Max results (default 5)"),
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            const cmd = ["t", "search", args.query];
            if (args.limit) cmd.push("--limit", String(Math.min(20, Math.max(1, args.limit))));
            return await nmem(withExplicitSpaceArg(cmd, args));
          }
        }),
        nowledge_mem_save_thread: tool({
          description: "Save the current OpenCode session as a full conversation thread in Nowledge Mem. Extracts the complete message history so any tool can find and read this conversation later. Idempotent: safe to call multiple times. Use at natural stopping points or when the user asks to save the session.",
          args: {
            summary: tool.schema.string().optional().describe("Brief description of what was discussed (used as thread title)"),
            ...spaceToolArgs()
          },
          async execute(args, ctx) {
            try {
              return JSON.stringify(await syncSessionThread(ctx, {
                reason: "manual_tool",
                summary: args.summary,
                spaceId: explicitSpaceForHttp(args),
                force: true,
                timeoutMs: 3e4
              }));
            } catch (err) {
              return JSON.stringify({
                error: `Session capture failed: ${err.message}. Use nowledge_mem_save_handoff for a curated summary instead.`
              });
            }
          }
        }),
        nowledge_mem_save_handoff: tool({
          description: "Save a curated handoff summary of the current session. Creates a structured thread that any future session in any tool can pick up from. Lighter than save_thread: use this for a quick summary when you do not need the full transcript.",
          args: {
            topic: tool.schema.string().describe("Brief topic or title for this session"),
            summary: tool.schema.string().describe(
              "Structured handoff: Goal, Decisions made, Key files touched, Risks/open questions, Suggested next steps"
            ),
            ...spaceToolArgs()
          },
          async execute(args, _ctx) {
            const title = `Session Handoff - ${args.topic}`;
            return await nmem(withExplicitSpaceArg(["t", "create", "-t", title, "-c", args.summary, "-s", "opencode"], args));
          }
        }),
        nowledge_mem_status: tool({
          description: "Check Nowledge Mem server connectivity and configuration. Use when memory tools fail or the user asks about setup.",
          args: {},
          async execute(_args, _ctx) {
            return await nmem(["status"]);
          }
        })
      },
      "experimental.chat.system.transform": async (_input, output) => {
        output.system.push(BEHAVIORAL_GUIDANCE);
      },
      event: async ({ event }) => {
        const sessionID = sessionIdFromEvent(event);
        if (!sessionID) return;
        if (event.type === "session.status") {
          const statusType = event.properties?.status?.type;
          if (statusType === "idle") {
            scheduleAutoThreadSync(sessionID, "session_status_idle");
          }
          return;
        }
        if (event.type === "session.idle") {
          scheduleAutoThreadSync(sessionID, "session_idle");
        }
      },
      "experimental.session.compacting": async (input2, output) => {
        if (input2.sessionID) {
          await syncSessionThread(
            { sessionID: input2.sessionID, directory },
            { reason: "session_compacting", force: false, timeoutMs: THREAD_SYNC_TIMEOUT_MS }
          ).catch((err) => {
            console.warn("[nowledge-mem] pre-compaction OpenCode thread sync failed:", err?.message ?? err);
          });
        }
        const reminder = [
          "IMPORTANT: You have Nowledge Mem tools (nowledge_mem_*) for cross-tool knowledge.",
          "After compaction, call nowledge_mem_context_bundle when identity, scope, or rules matter; use nowledge_mem_working_memory as the lightweight fallback.",
          "Continue searching and saving proactively."
        ].join("\n");
        output.context.push(reminder);
      }
    };
  }
};
export {
  index_default as default
};
