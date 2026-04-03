import type { PluginModule } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

const BEHAVIORAL_GUIDANCE = `## Nowledge Mem

You have Nowledge Mem tools for cross-tool knowledge management. Use them proactively.

**At session start:** Call \`nowledge_mem_working_memory\` to load today's briefing (priorities, recent decisions, open questions). Reference relevant parts naturally as the conversation progresses.

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

export default {
  id: "nowledge-mem",
  server: async (input) => {
    const { $, client } = input

    // --- CLI transport (for memory operations) ---

    async function nmem(args: string[]): Promise<string> {
      try {
        // Bun's $ tagged template escapes each array element as a separate
        // shell argument, so values containing spaces/quotes are safe.
        const result = await $`nmem --json ${args}`.text()
        return result.trim()
      } catch (err: any) {
        const stderr = String(err?.stderr ?? "")
        if (stderr.includes("command not found") || stderr.includes("not recognized")) {
          return JSON.stringify({
            error: "nmem CLI not found. Install it from Nowledge Mem: Settings > Developer Tools > Install CLI, or run: pip install nmem-cli",
          })
        }
        return JSON.stringify({ error: stderr || String(err) })
      }
    }

    // --- HTTP transport (for thread operations with large payloads) ---

    const apiUrl = process.env.NMEM_API_URL || "http://127.0.0.1:14242"
    const apiKey = process.env.NMEM_API_KEY

    async function nmemApi(
      path: string,
      body: unknown,
    ): Promise<{ ok: boolean; status: number; data: any }> {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30_000)
      try {
        const res = await fetch(`${apiUrl}${path}`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const data = await res.json().catch(() => null)
        return { ok: res.ok, status: res.status, data }
      } catch (err: any) {
        if (err.name === "AbortError") {
          return { ok: false, status: 504, data: { error: "Request timed out after 30s" } }
        }
        return { ok: false, status: 0, data: { error: err.message } }
      } finally {
        clearTimeout(timeout)
      }
    }

    // --- Transform OpenCode SDK messages to Nowledge Mem thread format ---

    function extractMessageContent(parts: any[]): string {
      const segments: string[] = []

      for (const part of parts) {
        switch (part.type) {
          case "text": {
            const text = part.content || part.text
            if (text) segments.push(text)
            break
          }
          case "tool": {
            const name = part.tool ?? part.name ?? "unknown"
            const status = part.state === "error" ? " (failed)" : ""
            segments.push(`[Tool: ${name}${status}]`)
            break
          }
          case "reasoning": {
            const reasoning = part.content || part.text
            if (reasoning) segments.push(`<thinking>\n${reasoning}\n</thinking>`)
            break
          }
          case "file":
            segments.push(`[File: ${part.filename ?? part.path ?? "attachment"}]`)
            break
          case "patch":
            segments.push(`[Patch: ${part.path ?? "file change"}]`)
            break
          // step-start, step-finish, snapshot, compaction, retry, agent, subtask
          // are structural markers, not user-visible content; skip them
        }
      }

      return segments.join("\n") || "(empty message)"
    }

    function safeTimestamp(raw: unknown): string {
      try {
        const d = new Date(raw as any)
        if (!isNaN(d.getTime())) return d.toISOString()
      } catch { /* fall through */ }
      return new Date().toISOString()
    }

    function toThreadMessages(sdkMessages: any[]): any[] {
      return sdkMessages
        .filter((m: any) => m?.info)
        .map(({ info, parts }: any) => ({
          content: extractMessageContent(parts ?? []),
          role: info.role === "user" ? "user" : "assistant",
          timestamp: safeTimestamp(info.time?.created ?? Date.now()),
          metadata: {
            external_id: `opencode-msg-${info.id}`,
            ...(info.agent ? { agent: info.agent } : {}),
            ...(info.role === "assistant" && info.modelID ? { model: info.modelID } : {}),
          },
        }))
    }

    return {
      tool: {
        nowledge_mem_working_memory: tool({
          description:
            "Read today's Working Memory briefing from Nowledge Mem: current focus areas, priorities, recent decisions, and open questions across all your AI tools. Call this near the start of each session.",
          args: {},
          async execute(_args, _ctx) {
            return await nmem(["wm", "read"])
          },
        }),

        nowledge_mem_search: tool({
          description:
            "Search the user's knowledge graph for past decisions, procedures, learnings, and context. Returns results from memories saved across all tools (Claude Code, Cursor, Gemini, ChatGPT, etc.). Search proactively when work connects to prior context.",
          args: {
            query: tool.schema
              .string()
              .describe("Natural language search query"),
            limit: tool.schema
              .number()
              .optional()
              .describe("Max results to return (default 5, max 20)"),
            label: tool.schema
              .string()
              .optional()
              .describe("Filter by label name"),
            mode: tool.schema
              .enum(["default", "deep"])
              .optional()
              .describe(
                "Search mode: 'default' for fast hybrid, 'deep' for broader conceptual matching",
              ),
          },
          async execute(args, _ctx) {
            const cmd = ["m", "search", args.query]
            if (args.limit) cmd.push("-n", String(Math.min(20, Math.max(1, args.limit))))
            if (args.label) cmd.push("-l", args.label)
            if (args.mode === "deep") cmd.push("--mode", "deep")
            return await nmem(cmd)
          },
        }),

        nowledge_mem_save: tool({
          description:
            "Save a decision, insight, procedure, or preference to Nowledge Mem so any future session in any tool can find it. Search first to check if a related memory already exists; if so, use nowledge_mem_update instead.",
          args: {
            content: tool.schema
              .string()
              .describe("The knowledge to save. Be specific: what was decided and why."),
            title: tool.schema
              .string()
              .describe("Short descriptive title for this memory"),
            unit_type: tool.schema
              .enum([
                "fact",
                "preference",
                "decision",
                "plan",
                "procedure",
                "learning",
                "context",
                "event",
              ])
              .optional()
              .describe("Type of knowledge (default: 'decision')"),
            labels: tool.schema
              .string()
              .optional()
              .describe("Comma-separated labels for categorization"),
            importance: tool.schema
              .number()
              .optional()
              .describe(
                "0.0-1.0 importance score. 0.8-1.0: major decisions. 0.5-0.7: useful patterns. 0.3-0.4: minor notes.",
              ),
          },
          async execute(args, _ctx) {
            const cmd = ["m", "add", args.content, "-t", args.title]
            if (args.unit_type) cmd.push("--unit-type", args.unit_type)
            if (args.labels) {
              for (const label of args.labels.split(",").map((l: string) => l.trim())) {
                if (label) cmd.push("-l", label)
              }
            }
            if (args.importance != null) cmd.push("-i", String(args.importance))
            return await nmem(cmd)
          },
        }),

        nowledge_mem_update: tool({
          description:
            "Update an existing memory with new or refined information. Use this instead of creating a duplicate when the new information extends or corrects an existing memory.",
          args: {
            memory_id: tool.schema
              .string()
              .describe("ID of the memory to update"),
            content: tool.schema
              .string()
              .optional()
              .describe("Updated content"),
            title: tool.schema
              .string()
              .optional()
              .describe("Updated title"),
            importance: tool.schema
              .number()
              .optional()
              .describe("Updated importance score"),
          },
          async execute(args, _ctx) {
            const cmd = ["m", "update", args.memory_id]
            if (args.content) cmd.push("-c", args.content)
            if (args.title) cmd.push("-t", args.title)
            if (args.importance != null) cmd.push("-i", String(args.importance))
            return await nmem(cmd)
          },
        }),

        nowledge_mem_thread_search: tool({
          description:
            "Search past conversations from any tool (Claude Code, ChatGPT, Cursor, etc.). Use when the user asks about a prior discussion or exact conversation history.",
          args: {
            query: tool.schema
              .string()
              .describe("Search query for past conversations"),
            limit: tool.schema
              .number()
              .optional()
              .describe("Max results (default 5)"),
          },
          async execute(args, _ctx) {
            const cmd = ["t", "search", args.query]
            if (args.limit) cmd.push("--limit", String(Math.min(20, Math.max(1, args.limit))))
            return await nmem(cmd)
          },
        }),

        nowledge_mem_save_thread: tool({
          description:
            "Save the current OpenCode session as a full conversation thread in Nowledge Mem. Extracts the complete message history so any tool can find and read this conversation later. Idempotent: safe to call multiple times. Use at natural stopping points or when the user asks to save the session.",
          args: {
            summary: tool.schema
              .string()
              .optional()
              .describe("Brief description of what was discussed (used as thread title)"),
          },
          async execute(args, ctx) {
            if (!ctx.sessionID) {
              return JSON.stringify({
                error: "No session ID available. Use nowledge_mem_save_handoff instead.",
              })
            }

            try {
              // Fetch full session messages via OpenCode SDK
              const sdkMessages = await client.session.messages({
                sessionID: ctx.sessionID,
              })

              if (!sdkMessages || sdkMessages.length === 0) {
                return JSON.stringify({ error: "No messages found in current session" })
              }

              const threadMessages = toThreadMessages(sdkMessages)
              if (threadMessages.length === 0) {
                return JSON.stringify({ error: "No extractable messages in current session" })
              }
              // Match import service convention: lowercase for dedup consistency
              const threadId = `opencode-${ctx.sessionID}`.toLowerCase()
              const title =
                args.summary ||
                threadMessages[0]?.content?.slice(0, 120) ||
                "OpenCode Session"

              // Try create first; if it fails (thread may already exist from
              // auto-sync or a previous save), fall back to append with dedup
              let res = await nmemApi("/threads", {
                thread_id: threadId,
                title,
                messages: threadMessages,
                source: "opencode",
                project: ctx.directory,
                metadata: { opencode_session_id: ctx.sessionID },
              })

              if (!res.ok) {
                res = await nmemApi(
                  `/threads/${encodeURIComponent(threadId)}/append`,
                  { messages: threadMessages, deduplicate: true },
                )
              }

              if (!res.ok) {
                return JSON.stringify({
                  error: `Thread save failed (${res.status}): ${JSON.stringify(res.data)}`,
                })
              }

              return JSON.stringify({
                success: true,
                thread_id: threadId,
                messages_saved: threadMessages.length,
                title,
              })
            } catch (err: any) {
              return JSON.stringify({
                error: `Session capture failed: ${err.message}. Use nowledge_mem_save_handoff for a curated summary instead.`,
              })
            }
          },
        }),

        nowledge_mem_save_handoff: tool({
          description:
            "Save a curated handoff summary of the current session. Creates a structured thread that any future session in any tool can pick up from. Lighter than save_thread: use this for a quick summary when you do not need the full transcript.",
          args: {
            topic: tool.schema
              .string()
              .describe("Brief topic or title for this session"),
            summary: tool.schema
              .string()
              .describe(
                "Structured handoff: Goal, Decisions made, Key files touched, Risks/open questions, Suggested next steps",
              ),
          },
          async execute(args, _ctx) {
            const title = `Session Handoff - ${args.topic}`
            return await nmem(["t", "create", "-t", title, "-c", args.summary, "-s", "opencode"])
          },
        }),

        nowledge_mem_status: tool({
          description:
            "Check Nowledge Mem server connectivity and configuration. Use when memory tools fail or the user asks about setup.",
          args: {},
          async execute(_args, _ctx) {
            return await nmem(["status"])
          },
        }),
      },

      "experimental.chat.system.transform": async (_input, output) => {
        output.system.push(BEHAVIORAL_GUIDANCE)
      },

      "experimental.session.compacting": async (_input, output) => {
        output.prompt += [
          "",
          "",
          "IMPORTANT: You have Nowledge Mem tools (nowledge_mem_*) for cross-tool knowledge.",
          "After compaction, call nowledge_mem_working_memory to restore your context.",
          "Continue searching and saving proactively.",
        ].join("\n")
      },
    }
  },
} satisfies PluginModule
