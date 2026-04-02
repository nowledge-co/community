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

**When to save (\`nowledge_mem_save\`):**
Save proactively when the conversation produces a decision, preference, plan, procedure, learning, or important context. Do not wait to be asked. Search first to avoid duplicates; update existing memories when the new information refines rather than replaces.

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

    async function nmem(args: string): Promise<string> {
      try {
        const result = await $`nmem --json ${args}`.text()
        return result.trim()
      } catch (err: any) {
        const stderr = err?.stderr ?? ""
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
      const res = await fetch(`${apiUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      return { ok: res.ok, status: res.status, data }
    }

    // --- Transform OpenCode SDK messages to Nowledge Mem thread format ---

    function extractMessageContent(parts: any[]): string {
      const segments: string[] = []

      for (const part of parts) {
        if (part.type === "text" && (part.content || part.text)) {
          segments.push(part.content ?? part.text)
        } else if (part.type === "tool") {
          const name = part.tool ?? part.name ?? "unknown"
          const status = part.state === "error" ? " (failed)" : ""
          segments.push(`[Tool call: ${name}${status}]`)
        } else if (part.type === "reasoning" && (part.content || part.text)) {
          // Include reasoning for completeness but mark it
          segments.push(`<thinking>\n${part.content ?? part.text}\n</thinking>`)
        }
      }

      return segments.join("\n") || "(empty message)"
    }

    function toThreadMessages(sdkMessages: any[]): any[] {
      return sdkMessages.map(({ info, parts }: any) => ({
        content: extractMessageContent(parts ?? []),
        role: info.role === "user" ? "user" : "assistant",
        timestamp: new Date(info.time?.created ?? Date.now()).toISOString(),
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
            return await nmem("wm read")
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
            let cmd = `m search "${args.query.replace(/"/g, '\\"')}"`
            if (args.limit) cmd += ` -n ${Math.min(20, Math.max(1, args.limit))}`
            if (args.label) cmd += ` -l "${args.label.replace(/"/g, '\\"')}"`
            if (args.mode === "deep") cmd += " --mode deep"
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
            let cmd = `m add "${args.content.replace(/"/g, '\\"')}" -t "${args.title.replace(/"/g, '\\"')}"`
            if (args.unit_type) cmd += ` --unit-type ${args.unit_type}`
            if (args.labels) {
              for (const label of args.labels.split(",").map((l) => l.trim())) {
                if (label) cmd += ` -l "${label.replace(/"/g, '\\"')}"`
              }
            }
            if (args.importance != null) cmd += ` -i ${args.importance}`
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
            let cmd = `m update ${args.memory_id}`
            if (args.content) cmd += ` -c "${args.content.replace(/"/g, '\\"')}"`
            if (args.title) cmd += ` -t "${args.title.replace(/"/g, '\\"')}"`
            if (args.importance != null) cmd += ` -i ${args.importance}`
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
            let cmd = `t search "${args.query.replace(/"/g, '\\"')}"`
            if (args.limit) cmd += ` --limit ${Math.min(20, Math.max(1, args.limit))}`
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
            try {
              // Fetch full session messages via OpenCode SDK
              const sdkMessages = await (client as any).session.messages({
                sessionID: ctx.sessionID,
              })

              if (!sdkMessages || sdkMessages.length === 0) {
                return JSON.stringify({ error: "No messages found in current session" })
              }

              const threadMessages = toThreadMessages(sdkMessages)
              const threadId = `opencode-${ctx.sessionID}`
              const title =
                args.summary ||
                threadMessages[0]?.content?.slice(0, 120) ||
                "OpenCode Session"

              // Try create; if thread exists, append with deduplication
              let res = await nmemApi("/threads", {
                thread_id: threadId,
                title,
                messages: threadMessages,
                source: "opencode",
                project: ctx.directory,
                metadata: { opencode_session_id: ctx.sessionID },
              })

              if (res.status === 409) {
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
              // Fall back to handoff-style save if SDK access fails
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
            const cmd = `t create -t "${title.replace(/"/g, '\\"')}" -c "${args.summary.replace(/"/g, '\\"')}" -s opencode`
            return await nmem(cmd)
          },
        }),

        nowledge_mem_status: tool({
          description:
            "Check Nowledge Mem server connectivity and configuration. Use when memory tools fail or the user asks about setup.",
          args: {},
          async execute(_args, _ctx) {
            return await nmem("status")
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
