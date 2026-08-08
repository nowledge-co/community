/**
 * Tool registry for the Nowledge Mem Amp connector.
 *
 * This module owns the static description of the nine `nowledge_mem_*` tools
 * (name, description, JSON-Schema `inputSchema`) and the factory that binds each
 * tool's execute function to its dependencies (CLI client, capture manager).
 *
 * Splitting the static definitions from the execute factories keeps the data
 * declarative and lets the static contract test assert the tool surface without
 * constructing any collaborators.
 */

import type { NmemCli } from "./cli"
import type { SessionSyncManager } from "./sync"
import type { JsonSchema, ToolContext, ToolExecuteResult } from "./types"

/** Source-app tag stamped on memories and threads produced by this connector. */
export const SOURCE_APP = "amp"

/** Common unit-type enumeration used by the save tool. */
const UNIT_TYPES = ["fact", "preference", "decision", "plan", "procedure", "learning", "context", "event"] as const

/** Shared search-mode enumeration used by the search tool. */
const SEARCH_MODES = ["default", "deep"] as const

/** Names of every tool the connector registers. */
export const TOOL_NAMES = [
  "nowledge_mem_context_bundle",
  "nowledge_mem_working_memory",
  "nowledge_mem_search",
  "nowledge_mem_save",
  "nowledge_mem_update",
  "nowledge_mem_thread_search",
  "nowledge_mem_save_thread",
  "nowledge_mem_save_handoff",
  "nowledge_mem_status",
] as const

/**
 * Required-argument marker for JSON-Schema entries.
 *
 * @param properties - Property definitions keyed by argument name.
 * @param required - Names of required properties.
 * @returns A complete {@link JsonSchema} object.
 */
function objectSchema(
  properties: Record<string, object>,
  required: string[] = [],
): JsonSchema {
  return { type: "object", properties, ...(required.length > 0 ? { required: [...required] } : {}) }
}

/** String property helper for JSON-Schema objects. */
function stringProperty(description: string): object {
  return { type: "string", description }
}

/** Number property helper for JSON-Schema objects. */
function numberProperty(description: string): object {
  return { type: "number", description }
}

/** Enum property helper for JSON-Schema objects. */
function enumProperty(description: string, values: readonly string[]): object {
  return { type: "string", enum: [...values], description }
}

/** Shape of a static tool definition before its execute handler is bound. */
export interface ToolDescriptor {
  /** Canonical tool name. */
  readonly name: (typeof TOOL_NAMES)[number]
  /** Human-readable description shown to the model. */
  readonly description: string
  /** JSON-Schema describing the tool arguments. */
  readonly inputSchema: JsonSchema
}

/**
 * The static tool definitions, in registration order.
 *
 * Each definition is plain data; the execute handlers are bound separately by
 * {@link createToolExecutors} so the definitions stay free of dependencies.
 */
export const TOOL_DEFINITIONS: readonly ToolDescriptor[] = [
  {
    name: "nowledge_mem_context_bundle",
    description:
      "Read Nowledge Mem's startup Context Bundle: owner identity, resolved AI Identity, active scope, active rules, Working Memory, and KFS paths. Call this near session start when behavior, identity, or scope matters.",
    inputSchema: objectSchema({}),
  },
  {
    name: "nowledge_mem_working_memory",
    description:
      "Read today's lightweight Working Memory briefing from Nowledge Mem: current focus areas, priorities, recent decisions, and open questions across all your AI tools. Use nowledge_mem_context_bundle for full startup identity/scope/rules context.",
    inputSchema: objectSchema({}),
  },
  {
    name: "nowledge_mem_search",
    description:
      "Search the user's knowledge graph for past decisions, procedures, learnings, and context. Returns results from memories saved across all tools (Claude Code, Cursor, Gemini, ChatGPT, etc.). Search proactively when work connects to prior context.",
    inputSchema: objectSchema(
      {
        query: stringProperty("Natural language search query"),
        limit: numberProperty("Max results to return (default 5, max 20)"),
        label: stringProperty("Filter by label name"),
        mode: enumProperty("Search mode: 'default' for fast hybrid, 'deep' for broader conceptual matching", SEARCH_MODES),
      },
      ["query"],
    ),
  },
  {
    name: "nowledge_mem_save",
    description:
      "Save a decision, insight, procedure, or preference to Nowledge Mem so any future session in any tool can find it. Search first to check if a related memory already exists; if so, use nowledge_mem_update instead.",
    inputSchema: objectSchema(
      {
        content: stringProperty("The knowledge to save. Be specific: what was decided and why."),
        title: stringProperty("Short descriptive title for this memory"),
        unit_type: enumProperty("Type of knowledge (default: 'decision')", UNIT_TYPES),
        labels: stringProperty("Comma-separated labels for categorization"),
        importance: numberProperty("0.0-1.0 importance score. 0.8-1.0: major decisions. 0.5-0.7: useful patterns. 0.3-0.4: minor notes."),
      },
      ["content", "title"],
    ),
  },
  {
    name: "nowledge_mem_update",
    description:
      "Update an existing memory with new or refined information. Use this instead of creating a duplicate when the new information extends or corrects an existing memory.",
    inputSchema: objectSchema(
      {
        memory_id: stringProperty("ID of the memory to update"),
        content: stringProperty("Updated content"),
        title: stringProperty("Updated title"),
        importance: numberProperty("Updated importance score"),
      },
      ["memory_id"],
    ),
  },
  {
    name: "nowledge_mem_thread_search",
    description:
      "Search past conversations from any tool (Claude Code, ChatGPT, Cursor, etc.). Use when the user asks about a prior discussion or exact conversation history.",
    inputSchema: objectSchema(
      {
        query: stringProperty("Search query for past conversations"),
        limit: numberProperty("Max results (default 5)"),
      },
      ["query"],
    ),
  },
  {
    name: "nowledge_mem_save_thread",
    description:
      "Save the current Amp session as a full conversation thread in Nowledge Mem. Extracts the complete message history so any tool can find and read this conversation later. Idempotent: safe to call multiple times. Use at natural stopping points or when the user asks to save the session.",
    inputSchema: objectSchema({
      summary: stringProperty("Brief description of what was discussed (used as thread title)"),
    }),
  },
  {
    name: "nowledge_mem_save_handoff",
    description:
      "Save a curated handoff summary of the current session. Creates a structured thread that any future session in any tool can pick up from. Lighter than save_thread: use this for a quick summary when you do not need the full transcript.",
    inputSchema: objectSchema(
      {
        topic: stringProperty("Brief topic or title for this session"),
        summary: stringProperty("Structured handoff: Goal, Decisions made, Key files touched, Risks/open questions, Suggested next steps"),
      },
      ["topic", "summary"],
    ),
  },
  {
    name: "nowledge_mem_status",
    description:
      "Check Nowledge Mem server connectivity and configuration. Use when memory tools fail or the user asks about setup.",
    inputSchema: objectSchema({}),
  },
]

/** Dependencies required to build tool execute handlers. */
export interface ToolDeps {
  /** CLI client used by all single-record memory operations. */
  readonly nmem: NmemCli
  /** Capture manager used by the save-thread tool. */
  readonly syncManager: SessionSyncManager
}

/** Reads a string argument, defaulting to `undefined` for absent/non-string values. */
function readString(input: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = input[key]
  return typeof value === "string" ? value : undefined
}

/** Reads a number argument, returning `undefined` for absent/non-number values. */
function readNumber(input: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const value = input[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/**
 * Builds the nine tool execute handlers bound to the given dependencies.
 *
 * @param deps - Injected dependencies (CLI client and capture manager).
 * @returns A map from tool name to execute handler.
 */
export function createToolExecutors(
  deps: ToolDeps,
): Record<(typeof TOOL_NAMES)[number], (input: Readonly<Record<string, unknown>>, ctx: ToolContext) => Promise<ToolExecuteResult>> {
  return {
    async nowledge_mem_context_bundle(): Promise<ToolExecuteResult> {
      const bundle = await deps.nmem(["context", "--source-app", SOURCE_APP])
      if (isNmemErrorPayload(bundle)) {
        return deps.nmem(["wm", "read"])
      }
      return bundle
    },

    async nowledge_mem_working_memory(): Promise<ToolExecuteResult> {
      return deps.nmem(["wm", "read"])
    },

    async nowledge_mem_search(input): Promise<ToolExecuteResult> {
      const query = readString(input, "query") ?? ""
      const cmd = ["m", "search", query]
      const limit = readNumber(input, "limit")
      if (limit !== undefined) cmd.push("-n", String(Math.min(20, Math.max(1, limit))))
      const label = readString(input, "label")
      if (label !== undefined) cmd.push("-l", label)
      const mode = readString(input, "mode")
      if (mode === "deep") cmd.push("--mode", "deep")
      return deps.nmem(cmd)
    },

    async nowledge_mem_save(input): Promise<ToolExecuteResult> {
      const content = readString(input, "content") ?? ""
      const title = readString(input, "title") ?? ""
      const cmd = ["m", "add", content, "-t", title, "--source", SOURCE_APP]
      const unitType = readString(input, "unit_type")
      if (unitType !== undefined) cmd.push("--unit-type", unitType)
      const labels = readString(input, "labels")
      if (labels !== undefined) {
        for (const label of labels.split(",").map((entry) => entry.trim())) {
          if (label.length > 0) cmd.push("-l", label)
        }
      }
      const importance = readNumber(input, "importance")
      if (importance !== undefined) cmd.push("-i", String(importance))
      return deps.nmem(cmd)
    },

    async nowledge_mem_update(input): Promise<ToolExecuteResult> {
      const memoryId = readString(input, "memory_id") ?? ""
      const cmd = ["m", "update", memoryId]
      const content = readString(input, "content")
      if (content !== undefined) cmd.push("-c", content)
      const title = readString(input, "title")
      if (title !== undefined) cmd.push("-t", title)
      const importance = readNumber(input, "importance")
      if (importance !== undefined) cmd.push("-i", String(importance))
      return deps.nmem(cmd)
    },

    async nowledge_mem_thread_search(input): Promise<ToolExecuteResult> {
      const query = readString(input, "query") ?? ""
      const cmd = ["t", "search", query]
      const limit = readNumber(input, "limit")
      if (limit !== undefined) cmd.push("--limit", String(Math.min(20, Math.max(1, limit))))
      return deps.nmem(cmd)
    },

    async nowledge_mem_save_thread(input, ctx): Promise<ToolExecuteResult> {
      const threadId = ctx.thread?.id
      if (threadId === undefined) {
        return JSON.stringify({
          error: "No active thread. Use nowledge_mem_save_handoff instead.",
        })
      }
      const summary = readString(input, "summary")
      try {
        const result = await deps.syncManager.syncNow(threadId)
        return JSON.stringify({ ...result, summary })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return JSON.stringify({
          error: `Session capture failed: ${message}. Use nowledge_mem_save_handoff for a curated summary instead.`,
        })
      }
    },

    async nowledge_mem_save_handoff(input): Promise<ToolExecuteResult> {
      const topic = readString(input, "topic") ?? ""
      const summary = readString(input, "summary") ?? ""
      const title = `Session Handoff - ${topic}`
      return deps.nmem(["t", "create", "-t", title, "-c", summary, "-s", SOURCE_APP])
    },

    async nowledge_mem_status(): Promise<ToolExecuteResult> {
      return deps.nmem(["status"])
    },
  }
}

/**
 * Detects whether a CLI stdout string is an error envelope.
 *
 * @param output - CLI stdout to inspect.
 * @returns `true` when the output parses as `{ "error": ... }`.
 */
export function isNmemErrorPayload(output: string): boolean {
  try {
    const parsed: unknown = JSON.parse(output)
    return typeof parsed === "object" && parsed !== null && Object.prototype.hasOwnProperty.call(parsed, "error")
  } catch {
    return false
  }
}
