import { Plugin } from "@opencode/plugin"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { createNmemCliRunner } from "./cli-runner.mjs"
import {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  isThreadAlreadyExistsResponse,
  recreateMissingThread,
  opencodeThreadId,
  selectAcknowledgedDelta,
  sessionSyncLaneKey,
  stableMessageFingerprint,
  type AcknowledgedCursor,
} from "./session-delta.ts"
import { toThreadMessages } from "./thread-messages.ts"
import { resolveThreadSyncTimeoutMs } from "./thread-sync-timeout.ts"

const THREAD_SYNC_TIMEOUT_MS = resolveThreadSyncTimeoutMs(process.env.NMEM_SYNC_TIMEOUT_MS)

const BEHAVIORAL_GUIDANCE = `## Nowledge Mem

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
`

type SpaceToolArgs = {
  space?: string
  space_id?: string
}

type SearchArgs = SpaceToolArgs & {
  query: string
  limit?: number
  label?: string
  mode?: "default" | "deep"
}

type SaveArgs = SpaceToolArgs & {
  content: string
  title: string
  unit_type?: string
  labels?: string
  importance?: number
}

type UpdateArgs = SpaceToolArgs & {
  memory_id: string
  content?: string
  title?: string
  importance?: number
}

type ThreadSearchArgs = SpaceToolArgs & {
  query: string
  limit?: number
}

type SaveThreadArgs = SpaceToolArgs & {
  summary?: string
}

type HandoffArgs = SpaceToolArgs & {
  topic: string
  summary: string
}

type SyncReason = "manual_tool" | "session_status_idle" | "session_idle" | "session_compacting"
type SessionSyncState = {
  timer?: ReturnType<typeof setTimeout>
  inFlight?: Promise<void>
  pending?: boolean
  created?: boolean
  acknowledged?: AcknowledgedCursor
}

type V2EventLike = {
  type?: string
  data?: {
    sessionID?: unknown
    sessionId?: unknown
    session?: { id?: unknown }
    status?: { type?: unknown }
  }
}

function spaceToolProperties() {
  return {
    space: {
      type: "string",
      description: "Optional Nowledge Space name or alias for this one call",
    },
    space_id: {
      type: "string",
      description: "Optional Nowledge Space id/key for this one call; takes priority over space",
    },
  }
}

export default Plugin.define({
  id: "nowledge-mem",
  async setup(ctx) {
    const directory = ctx.location.directory
    const runNmemCli = createNmemCliRunner(undefined)

    // --- CLI transport (for memory operations) ---

    async function nmem(args: string[]): Promise<string> {
      try {
        const result = await runNmemCli(withAmbientSpaceArg(args))
        return result.trim()
      } catch (err: any) {
        const stderr = String(err?.stderr ?? "")
        if (
          err?.code === "ENOENT" ||
          stderr.includes("command not found") ||
          stderr.includes("not recognized")
        ) {
          return JSON.stringify({
            error: "nmem CLI not found. Install it from Nowledge Mem: Settings > Developer Tools > Install CLI, or run: pip install nmem-cli",
          })
        }
        return JSON.stringify({ error: stderr || String(err) })
      }
    }

    function isNmemErrorPayload(output: string): boolean {
      try {
        const parsed = JSON.parse(output)
        return parsed && typeof parsed === "object" && "error" in parsed
      } catch {
        return false
      }
    }

    // --- HTTP transport (for thread operations with large payloads) ---

    function readSharedConfig(): Record<string, unknown> {
      const path = join(homedir(), ".nowledge-mem", "config.json")
      try {
        if (!existsSync(path)) return {}
        const parsed = JSON.parse(readFileSync(path, "utf8"))
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
      } catch {
        return {}
      }
    }

    function stringConfigValue(value: unknown): string | undefined {
      return typeof value === "string" ? value.trim() || undefined : undefined
    }

    function withAmbientSpaceArg(args: string[]): string[] {
      let next = args
      if (ambientSpaceId && !next.includes("--space") && !next.includes("--space-id")) {
        const scopedCommands = new Set(["context", "ctx", "wm", "m", "memories", "t", "threads"])
        if (scopedCommands.has(next[0] ?? "")) {
          next = [...next, "--space", ambientSpaceId]
        }
      }
      if (next[0] !== "context" && next[0] !== "ctx") return next
      if (ambientAgentId && !next.includes("--agent-id")) {
        next = [...next, "--agent-id", ambientAgentId]
      }
      if (ambientHostAgentId && !next.includes("--host-agent-id")) {
        next = [...next, "--host-agent-id", ambientHostAgentId]
      }
      return next
    }

    function readEnvOrConfig(...keys: string[]): string | undefined {
      for (const key of keys) {
        const envValue = process.env[key]?.trim()
        if (envValue) return envValue
      }
      for (const key of keys) {
        const configValue = stringConfigValue(sharedConfig[key])
        if (configValue) return configValue
      }
      return undefined
    }

    const sharedConfig = readSharedConfig()
    const apiUrl = (
      process.env.NMEM_API_URL?.trim() ||
      stringConfigValue(sharedConfig.apiUrl) ||
      "http://127.0.0.1:14242"
    ).replace(/\/+$/, "")
    const apiKey = process.env.NMEM_API_KEY?.trim() || stringConfigValue(sharedConfig.apiKey)
    const ambientSpaceId =
      process.env.NMEM_SPACE?.trim() ||
      process.env.NMEM_SPACE_ID?.trim() ||
      stringConfigValue(sharedConfig.space) ||
      stringConfigValue(sharedConfig.spaceId) ||
      stringConfigValue(sharedConfig.space_id)
    const ambientAgentId = readEnvOrConfig("NMEM_AGENT_ID", "agentId", "agent_id")
    const ambientHostAgentId = readEnvOrConfig("NMEM_HOST_AGENT_ID", "hostAgentId", "host_agent_id")

    function withAmbientSpace(body: unknown): unknown {
      if (!ambientSpaceId || body == null || typeof body !== "object" || Array.isArray(body)) {
        return body
      }
      if ("space_id" in body) {
        return body
      }
      return { ...body, space_id: ambientSpaceId }
    }

    function stringToolValue(value: unknown): string | undefined {
      return typeof value === "string" ? value.trim() || undefined : undefined
    }

    function explicitSpaceForCli(args: SpaceToolArgs): string[] {
      const spaceId = stringToolValue(args.space_id)
      if (spaceId) return ["--space-id", spaceId]
      const space = stringToolValue(args.space)
      return space ? ["--space", space] : []
    }

    function explicitSpaceForHttp(args: SpaceToolArgs): string | undefined {
      return stringToolValue(args.space_id) || stringToolValue(args.space)
    }

    function withExplicitSpaceArg(cmd: string[], args: SpaceToolArgs): string[] {
      return [...cmd, ...explicitSpaceForCli(args)]
    }

    async function nmemApi(
      path: string,
      body: unknown,
      timeoutMs = 30_000,
    ): Promise<{ ok: boolean; status: number; data: any }> {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`
        headers["X-NMEM-API-Key"] = apiKey
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)
      try {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(withAmbientSpace(body)),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        return { ok: res.ok, status: res.status, data }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return { ok: false, status: 504, data: { error: `Request timed out after ${Math.round(timeoutMs / 1000)}s` } }
        }
        return { ok: false, status: 0, data: { error: err.message } }
      } finally {
        clearTimeout(timeout)
      }
    }

    /*
     * Keep declarations above this comment; the next block is the OpenCode v2
     * session message read. The ambient identity convention lets orchestrators
     * set NMEM_AGENT_ID or NMEM_HOST_AGENT_ID per child agent without changing
     * OpenCode's plugin API.
     */

    // --- Read OpenCode v2 session messages for Nowledge Mem thread capture ---

    async function fetchSessionMessages(sessionID: string): Promise<unknown[]> {
      try {
        const messages = await ctx.session.context({ sessionID } as any)
        return Array.isArray(messages) ? messages : []
      } catch (error) {
        console.warn(
          `[nowledge-mem] failed to read OpenCode session messages for ${sessionID}:`,
          error instanceof Error ? error.message : error,
        )
        return []
      }
    }

    const syncStates = new Map<string, SessionSyncState>()
    const autoSyncDebounceMs = Math.max(
      250,
      Number(process.env.NMEM_OPENCODE_AUTO_SYNC_DEBOUNCE_MS ?? "1500") || 1500,
    )
    const autoSyncEnabled = !["0", "false", "off", "no"].includes(
      (process.env.NMEM_OPENCODE_AUTO_SYNC ?? "1").trim().toLowerCase(),
    )

    function syncStateFor(sessionID: string, spaceId = ambientSpaceId): SessionSyncState {
      const key = sessionSyncLaneKey(
        sessionID,
        apiUrl,
        apiKey,
        spaceId,
        ambientAgentId,
        ambientHostAgentId,
      )
      const existing = syncStates.get(key)
      if (existing) return existing
      const created: SessionSyncState = {}
      syncStates.set(key, created)
      return created
    }

    function threadMetadata(sessionID: string, reason: SyncReason): Record<string, unknown> {
      return {
        opencode_session_id: sessionID,
        source_app: "opencode",
        sync_reason: reason,
        live_capture: reason !== "manual_tool",
        ...(ambientAgentId ? { agent_id: ambientAgentId } : {}),
        ...(ambientHostAgentId ? { host_agent_id: ambientHostAgentId } : {}),
      }
    }

    async function mergeThreadMetadata(
      threadId: string,
      metadata: Record<string, unknown>,
      timeoutMs: number,
    ): Promise<void> {
      await nmemApi(
        `/threads/${encodeURIComponent(threadId)}/metadata/merge`,
        { metadata, only_missing: true },
        timeoutMs,
      )
    }

    async function syncSessionThread(
      session: { sessionID?: string; directory?: string },
      options: {
        reason: SyncReason
        summary?: string
        spaceId?: string
        force?: boolean
        timeoutMs?: number
      },
    ): Promise<Record<string, unknown>> {
      if (!session.sessionID) {
        return { error: "No session ID available. Use nowledge_mem_save_handoff instead." }
      }

      const timeoutMs = options.timeoutMs ?? 30_000
      const sdkMessages = await fetchSessionMessages(session.sessionID)

      if (!sdkMessages || sdkMessages.length === 0) {
        return { skipped: true, reason: "no_messages", session_id: session.sessionID }
      }

      const threadMessages = toThreadMessages(sdkMessages)
      if (threadMessages.length === 0) {
        return { skipped: true, reason: "no_extractable_messages", session_id: session.sessionID }
      }
      const hasUser = threadMessages.some((message) => message.role === "user")
      const hasAssistant = threadMessages.some((message) => message.role === "assistant")
      if (!hasUser || !hasAssistant) {
        return { skipped: true, reason: "incomplete_turn", session_id: session.sessionID }
      }

      const state = syncStateFor(session.sessionID, options.spaceId || ambientSpaceId)
      const delta = selectAcknowledgedDelta(
        threadMessages,
        options.force ? undefined : state.acknowledged,
        (message) => String(message?.metadata?.external_id ?? ""),
        stableMessageFingerprint,
      )
      if (delta.messages.length === 0) {
        return { skipped: true, reason: "already_synced", session_id: session.sessionID }
      }

      const threadId = opencodeThreadId(session.sessionID)
      const title =
        options.summary ||
        threadMessages.find((message) => message.role === "user")?.content?.slice(0, 120) ||
        threadMessages[0]?.content?.slice(0, 120) ||
        "OpenCode Session"
      const metadata = threadMetadata(session.sessionID, options.reason)
      const projectPath = session.directory ?? directory

      const createBody = {
        thread_id: threadId,
        title,
        messages: threadMessages,
        source: "opencode",
        project: projectPath,
        workspace: projectPath,
        ...(options.spaceId ? { space_id: options.spaceId } : {}),
        metadata,
      }
      let res = state.created
        ? { ok: false, status: 409, data: null }
        : await nmemApi("/threads", createBody, timeoutMs)
      let action = state.created ? "appended" : "created"
      let checkpointed = false
      let persistedMessages = delta.messages.length

      if (!res.ok && isThreadAlreadyExistsResponse(res.status, res.data)) {
        state.created = true
        await mergeThreadMetadata(threadId, metadata, timeoutMs).catch(() => undefined)
        res = await nmemApi(
          `/threads/${encodeURIComponent(threadId)}/append`,
          {
            messages: delta.messages,
            deduplicate: true,
            idempotency_key: `opencode:live:${session.sessionID}:${delta.start}-${delta.end}:${delta.next.prefixFingerprint}`,
            ...(state.acknowledged && !delta.reset
              ? { expected_message_count: state.acknowledged.remoteCount }
              : {}),
            ...(options.spaceId ? { space_id: options.spaceId } : ambientSpaceId ? { space_id: ambientSpaceId } : {}),
          },
          timeoutMs,
        )
        checkpointed = Boolean(state.acknowledged && !delta.reset)
        action = "appended"
      }

      if (!res.ok && checkpointed && isCheckpointConflictResponse(res.data)) {
        res = await nmemApi(
          `/threads/${encodeURIComponent(threadId)}/append`,
          {
            messages: threadMessages,
            deduplicate: true,
            idempotency_key: `opencode:reconcile:${session.sessionID}:${delta.next.prefixFingerprint}`,
            ...(options.spaceId ? { space_id: options.spaceId } : ambientSpaceId ? { space_id: ambientSpaceId } : {}),
          },
          timeoutMs,
        )
        checkpointed = false
        persistedMessages = threadMessages.length
        action = "reconciled"
      }

      const recovered = await recreateMissingThread(res, async () => {
        state.created = false
        return nmemApi("/threads", createBody, timeoutMs)
      })
      if (recovered.recreated) {
        res = recovered.response
        action = "created"
        checkpointed = false
        persistedMessages = threadMessages.length
      }

      if (!res.ok) {
        return {
          error: `Thread save failed (${res.status}): ${JSON.stringify(res.data)}`,
          thread_id: threadId,
          session_id: session.sessionID,
        }
      }
      const remoteCount = action === "created"
        ? createAcknowledgedRemoteCount(res.data, threadId)
        : appendAcknowledgedRemoteCount(res.data)
      if (remoteCount === undefined) {
        return {
          error: "Thread save did not include an explicit persistence acknowledgement; cursor was preserved",
          thread_id: threadId,
          session_id: session.sessionID,
        }
      }
      if (checkpointed && !isCheckpointedAppendAck(res.data)) {
        return {
          error: "Thread append was not acknowledged as checkpointed; cursor was preserved",
          thread_id: threadId,
          session_id: session.sessionID,
        }
      }

      state.created = true
      state.acknowledged = { ...delta.next, remoteCount }
      return {
        success: true,
        action,
        thread_id: threadId,
        messages_saved: persistedMessages,
        checkpoint_reset: delta.reset,
        title,
        sync_reason: options.reason,
      }
    }

    function scheduleAutoThreadSync(sessionID: string, reason: SyncReason): void {
      if (!autoSyncEnabled) return
      const state = syncStateFor(sessionID)
      if (state.timer) clearTimeout(state.timer)
      state.timer = setTimeout(() => {
        state.timer = undefined
        void runAutoThreadSync(sessionID, reason)
      }, autoSyncDebounceMs)
    }

    async function runAutoThreadSync(sessionID: string, reason: SyncReason): Promise<void> {
      const state = syncStateFor(sessionID)
      if (state.inFlight) {
        state.pending = true
        return
      }
      state.inFlight = syncSessionThread(
        { sessionID, directory },
        { reason, force: false, timeoutMs: THREAD_SYNC_TIMEOUT_MS },
      )
        .then((result) => {
          if ("error" in result) {
            console.warn("[nowledge-mem] automatic OpenCode thread sync failed:", result.error)
          }
        })
        .catch((err: any) => {
          console.warn("[nowledge-mem] automatic OpenCode thread sync failed:", err?.message ?? err)
        })
        .finally(() => {
          state.inFlight = undefined
          if (state.pending) {
            state.pending = false
            scheduleAutoThreadSync(sessionID, reason)
          }
        })
      await state.inFlight
    }

    function sessionIdFromEvent(event: V2EventLike): string | undefined {
      const data = event?.data ?? {}
      const sessionID = data.sessionID ?? data.sessionId ?? data.session?.id
      return typeof sessionID === "string" && sessionID ? sessionID : undefined
    }

    // --- v2 tool registration (replaces the v1 returned tool map) ---

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "nowledge_mem_context_bundle",
        description:
          "Read Nowledge Mem's startup Context Bundle: owner identity, resolved AI Identity, active scope, active rules, Working Memory, and KFS paths. Call this near session start when behavior, identity, or scope matters.",
        input: {
          type: "object",
          properties: {
            ...spaceToolProperties(),
          },
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as SpaceToolArgs
          const bundle = await nmem(withExplicitSpaceArg(["context", "--source-app", "opencode"], args))
          if (isNmemErrorPayload(bundle)) {
            return { content: await nmem(withExplicitSpaceArg(["wm", "read"], args)) }
          }
          return { content: bundle }
        },
      })

      editor.add({
        name: "nowledge_mem_working_memory",
        description:
          "Read today's lightweight Working Memory briefing from Nowledge Mem: current focus areas, priorities, recent decisions, and open questions across all your AI tools. Use nowledge_mem_context_bundle for full startup identity/scope/rules context.",
        input: {
          type: "object",
          properties: {
            ...spaceToolProperties(),
          },
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as SpaceToolArgs
          return { content: await nmem(withExplicitSpaceArg(["wm", "read"], args)) }
        },
      })

      editor.add({
        name: "nowledge_mem_search",
        description:
          "Search the user's knowledge graph for past decisions, procedures, learnings, and context. Returns results from memories saved across all tools (Claude Code, Cursor, Gemini, ChatGPT, etc.). Search proactively when work connects to prior context.",
        input: {
          type: "object",
          properties: {
            query: { type: "string", description: "Natural language search query" },
            limit: { type: "number", description: "Max results to return (default 5, max 20)" },
            label: { type: "string", description: "Filter by label name" },
            mode: {
              type: "string",
              enum: ["default", "deep"],
              description:
                "Search mode: 'default' for fast hybrid, 'deep' for broader conceptual matching",
            },
            ...spaceToolProperties(),
          },
          required: ["query"],
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as SearchArgs
          const cmd = ["m", "search", args.query]
          if (args.limit) cmd.push("-n", String(Math.min(20, Math.max(1, args.limit))))
          if (args.label) cmd.push("-l", args.label)
          if (args.mode === "deep") cmd.push("--mode", "deep")
          return { content: await nmem(withExplicitSpaceArg(cmd, args)) }
        },
      })

      editor.add({
        name: "nowledge_mem_save",
        description:
          "Save a decision, insight, procedure, or preference to Nowledge Mem so any future session in any tool can find it. Search first to check if a related memory already exists; if so, use nowledge_mem_update instead.",
        input: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "The knowledge to save. Be specific: what was decided and why.",
            },
            title: { type: "string", description: "Short descriptive title for this memory" },
            unit_type: {
              type: "string",
              enum: [
                "fact",
                "preference",
                "decision",
                "plan",
                "procedure",
                "learning",
                "context",
                "event",
              ],
              description: "Type of knowledge (default: 'decision')",
            },
            labels: { type: "string", description: "Comma-separated labels for categorization" },
            importance: {
              type: "number",
              description:
                "0.0-1.0 importance score. 0.8-1.0: major decisions. 0.5-0.7: useful patterns. 0.3-0.4: minor notes.",
            },
            ...spaceToolProperties(),
          },
          required: ["content", "title"],
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as SaveArgs
          const cmd = ["m", "add", args.content, "-t", args.title, "--source", "opencode"]
          if (args.unit_type) cmd.push("--unit-type", args.unit_type)
          if (args.labels) {
            for (const label of args.labels.split(",").map((l: string) => l.trim())) {
              if (label) cmd.push("-l", label)
            }
          }
          if (args.importance != null) cmd.push("-i", String(args.importance))
          return { content: await nmem(withExplicitSpaceArg(cmd, args)) }
        },
      })

      editor.add({
        name: "nowledge_mem_update",
        description:
          "Update an existing memory with new or refined information. Use this instead of creating a duplicate when the new information extends or corrects an existing memory.",
        input: {
          type: "object",
          properties: {
            memory_id: { type: "string", description: "ID of the memory to update" },
            content: { type: "string", description: "Updated content" },
            title: { type: "string", description: "Updated title" },
            importance: { type: "number", description: "Updated importance score" },
            ...spaceToolProperties(),
          },
          required: ["memory_id"],
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as UpdateArgs
          const cmd = ["m", "update", args.memory_id]
          if (args.content) cmd.push("-c", args.content)
          if (args.title) cmd.push("-t", args.title)
          if (args.importance != null) cmd.push("-i", String(args.importance))
          return { content: await nmem(withExplicitSpaceArg(cmd, args)) }
        },
      })

      editor.add({
        name: "nowledge_mem_thread_search",
        description:
          "Search past conversations from any tool (Claude Code, ChatGPT, Cursor, etc.). Use when the user asks about a prior discussion or exact conversation history.",
        input: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query for past conversations" },
            limit: { type: "number", description: "Max results (default 5)" },
            ...spaceToolProperties(),
          },
          required: ["query"],
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as ThreadSearchArgs
          const cmd = ["t", "search", args.query]
          if (args.limit) cmd.push("--limit", String(Math.min(20, Math.max(1, args.limit))))
          return { content: await nmem(withExplicitSpaceArg(cmd, args)) }
        },
      })

      editor.add({
        name: "nowledge_mem_save_thread",
        description:
          "Save the current OpenCode session as a full conversation thread in Nowledge Mem. Extracts the complete message history so any tool can find and read this conversation later. Idempotent: safe to call multiple times. Use at natural stopping points or when the user asks to save the session.",
        input: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Brief description of what was discussed (used as thread title)",
            },
            ...spaceToolProperties(),
          },
          additionalProperties: false,
        },
        async execute(rawInput, toolContext) {
          const args = rawInput as SaveThreadArgs
          try {
            return {
              content: JSON.stringify(await syncSessionThread({
                sessionID: String(toolContext.sessionID),
                directory,
              }, {
                reason: "manual_tool",
                summary: args.summary,
                spaceId: explicitSpaceForHttp(args),
                force: true,
                timeoutMs: 30_000,
              })),
            }
          } catch (err: any) {
            return {
              content: JSON.stringify({
                error: `Session capture failed: ${err.message}. Use nowledge_mem_save_handoff for a curated summary instead.`,
              }),
            }
          }
        },
      })

      editor.add({
        name: "nowledge_mem_save_handoff",
        description:
          "Save a curated handoff summary of the current session. Creates a structured thread that any future session in any tool can pick up from. Lighter than save_thread: use this for a quick summary when you do not need the full transcript.",
        input: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Brief topic or title for this session" },
            summary: {
              type: "string",
              description:
                "Structured handoff: Goal, Decisions made, Key files touched, Risks/open questions, Suggested next steps",
            },
            ...spaceToolProperties(),
          },
          required: ["topic", "summary"],
          additionalProperties: false,
        },
        async execute(rawInput) {
          const args = rawInput as HandoffArgs
          const title = `Session Handoff - ${args.topic}`
          return { content: await nmem(withExplicitSpaceArg(["t", "create", "-t", title, "-c", args.summary, "-s", "opencode"], args)) }
        },
      })

      editor.add({
        name: "nowledge_mem_status",
        description:
          "Check Nowledge Mem server connectivity and configuration. Use when memory tools fail or the user asks about setup.",
        input: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute() {
          return { content: await nmem(["status"]) }
        },
      })
    })

    // --- v2 session hooks (replace the v1 returned hook map) ---

    await ctx.session.hook("context", (event) => {
      event.system.push({ type: "text", text: BEHAVIORAL_GUIDANCE })
    })

    await ctx.session.hook("compaction", async (event) => {
      const sessionID = String(event.sessionID ?? "")
      if (sessionID) {
        await syncSessionThread(
          { sessionID, directory },
          { reason: "session_compacting", force: false, timeoutMs: THREAD_SYNC_TIMEOUT_MS },
        ).catch((err: any) => {
          console.warn("[nowledge-mem] pre-compaction OpenCode thread sync failed:", err?.message ?? err)
        })
      }
      const reminder = [
        "IMPORTANT: You have Nowledge Mem tools (nowledge_mem_*) for cross-tool knowledge.",
        "After compaction, call nowledge_mem_context_bundle when identity, scope, or rules matter; use nowledge_mem_working_memory as the lightweight fallback.",
        "Continue searching and saving proactively.",
      ].join("\n")
      event.system.push({ type: "text", text: reminder })
    })

    // --- v2 event subscription (replaces the v1 returned event hook) ---

    const controller = new AbortController()
    void (async () => {
      try {
        for await (const rawEvent of ctx.event.subscribe({ signal: controller.signal })) {
          const event = rawEvent as V2EventLike
          const sessionID = sessionIdFromEvent(event)
          if (!sessionID) continue
          if (event.type === "session.status") {
            if (event.data?.status?.type === "idle") {
              scheduleAutoThreadSync(sessionID, "session_status_idle")
            }
            continue
          }
          if (event.type === "session.idle") {
            scheduleAutoThreadSync(sessionID, "session_idle")
          }
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          console.warn("[nowledge-mem] OpenCode event subscription failed:", err?.message ?? err)
        }
      }
    })()

    return () => {
      controller.abort()
      for (const state of syncStates.values()) {
        if (state.timer) clearTimeout(state.timer)
      }
      syncStates.clear()
    }
  },
})
