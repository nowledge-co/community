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
`

export default {
  id: "nowledge-mem",
  server: async (input) => {
    const { $ } = input

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

        nowledge_mem_save_handoff: tool({
          description:
            "Save a resumable handoff summary of the current session. Creates a structured thread that any future session in any tool can pick up from. Use when the user asks to save progress or wrap up.",
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
            const cmd = `t create -t "${title.replace(/"/g, '\\"')}" -c "${args.summary.replace(/"/g, '\\"')}" -s generic-agent`
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
