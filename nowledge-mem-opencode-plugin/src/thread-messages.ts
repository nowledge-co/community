import { normalizedTimestamp, stableMessageFingerprint } from "./session-delta.ts"

/**
 * Pure transform from OpenCode v2 session messages (`ctx.session.context`) to
 * Nowledge Mem thread messages.
 *
 * OpenCode v2 returns flat, tagged message objects rather than the v1
 * `{ info, parts }` columns, so this lives beside `session-delta` as plain,
 * dependency-free logic that stays unit-testable without an OpenCode host.
 */

/** One tool call, in the shape the Mem Thread view renders as Input/Output/Error. */
export type ToolActivity = {
  id?: string
  name: string
  status?: string
  input?: string
  output?: string
  error?: string
  success?: false
}

export type ThreadMessage = {
  content: string
  role: "user" | "assistant"
  timestamp?: string
  metadata: {
    external_id: string
    source_app: "opencode"
    agent?: string
    model?: string
    tool_activities?: ToolActivity[]
  }
}

type SessionTextPart = { type: "text"; text?: string }
type SessionReasoningPart = { type: "reasoning"; text?: string }
type SessionToolPart = {
  type: "tool"
  id?: string
  name?: string
  state?: {
    status?: string
    /** An object once parsed; the partial argument string while streaming. */
    input?: unknown
    content?: Array<{ type?: string; text?: string }>
    error?: { message?: string }
  }
}
type SessionAssistantContent = SessionTextPart | SessionReasoningPart | SessionToolPart

/**
 * Structural view of the v2 `SessionMessageInfo` fields this plugin reads.
 * A single permissive shape avoids depending on the OpenCode client types,
 * which are not a direct package dependency.
 */
export type SessionMessage = {
  type?: string
  id?: string
  time?: { created?: number }
  text?: string
  files?: Array<{ name?: string }>
  agent?: string
  model?: { id?: string }
  content?: SessionAssistantContent[]
}

/** Code points kept per captured tool field, so no call stores unbounded text. */
const TOOL_DETAIL_LIMIT = 500

/** Mem already holds what its own tools read and write; the Thread only notes that they ran. */
const MEM_TOOL_PREFIX = "nowledge_mem_"

/** Walks code points only up to the limit, so large tool output stays cheap. */
function clip(text: string): string {
  if (text.length <= TOOL_DETAIL_LIMIT) return text
  let kept = 0
  let end = 0
  for (const char of text) {
    if (kept === TOOL_DETAIL_LIMIT) return `${text.slice(0, end)}...`
    kept += 1
    end += char.length
  }
  return text
}

/**
 * The Thread view renders tool output as Markdown. A fence longer than any
 * backtick run in the text keeps it literal: no headings, links, or raw HTML.
 */
function fenced(text: string): string {
  const longestRun = Math.max(0, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length))
  const fence = "`".repeat(Math.max(3, longestRun + 1))
  return `${fence}\n${text}\n${fence}`
}

function toolInput(input: unknown): string {
  if (typeof input === "string") return input.trim()
  if (!input || typeof input !== "object" || Object.keys(input).length === 0) return ""
  return JSON.stringify(input, null, 2)
}

function toolActivity(part: SessionToolPart): ToolActivity {
  const activity: ToolActivity = { name: part.name ?? "unknown" }
  if (part.id) activity.id = part.id
  const state = part.state
  if (!state) return activity

  if (state.status) activity.status = state.status
  if (!activity.name.startsWith(MEM_TOOL_PREFIX)) {
    const input = toolInput(state.input)
    if (input) activity.input = clip(input)
    // Keep leading indentation (e.g. `git status --short` columns); drop only
    // surrounding blank lines.
    const output = (state.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .replace(/^(?:[ \t]*\r?\n)+/, "")
      .trimEnd()
    if (output) activity.output = fenced(clip(output))
  }
  if (state.status === "error") {
    activity.success = false
    const message = state.error?.message?.trim()
    if (message) activity.error = clip(message)
  }
  return activity
}

/**
 * A stored message is never rewritten, yet its tool state can still change
 * after capture (a tool finishing, OpenCode pruning old output). Leaving tool
 * activity out of the delta fingerprint keeps such a change from forcing a full
 * replay that could not update the stored copy anyway.
 */
export function threadMessageFingerprint(message: ThreadMessage): string {
  return stableMessageFingerprint({
    ...message,
    metadata: { ...message.metadata, tool_activities: undefined },
  })
}

export function extractMessageContent(message: SessionMessage): string {
  if (message.type === "user") {
    const segments: string[] = []
    if (message.text) segments.push(message.text)
    for (const file of message.files ?? []) {
      segments.push(`[File: ${file.name ?? "attachment"}]`)
    }
    return segments.join("\n") || "(empty message)"
  }

  const segments: string[] = []
  for (const part of message.content ?? []) {
    switch (part.type) {
      case "text":
        if (part.text) segments.push(part.text)
        break
      case "reasoning":
        if (part.text) segments.push(`<thinking>\n${part.text}\n</thinking>`)
        break
      case "tool": {
        const name = part.name ?? "unknown"
        const status = part.state?.status === "error" ? " (failed)" : ""
        segments.push(`[Tool: ${name}${status}]`)
        break
      }
    }
  }
  return segments.join("\n") || "(empty message)"
}

export function toThreadMessages(sdkMessages: unknown): ThreadMessage[] {
  if (!Array.isArray(sdkMessages)) return []

  const threadMessages: ThreadMessage[] = []
  for (const raw of sdkMessages) {
    const message = raw as SessionMessage
    if (message?.type !== "user" && message?.type !== "assistant") continue

    const id = typeof message.id === "string" ? message.id : ""
    const timestamp = normalizedTimestamp(message.time?.created)
    const metadata: ThreadMessage["metadata"] = {
      external_id: `opencode-msg-${id}`,
      source_app: "opencode",
    }
    if (message.type === "assistant") {
      if (message.agent) metadata.agent = message.agent
      if (message.model?.id) metadata.model = message.model.id
      // One entry per `[Tool: ...]` marker, in order: the Thread view pairs them.
      const tools = (message.content ?? []).filter((part): part is SessionToolPart => part.type === "tool")
      if (tools.length) metadata.tool_activities = tools.map(toolActivity)
    }

    threadMessages.push({
      content: extractMessageContent(message),
      role: message.type,
      ...(timestamp ? { timestamp } : {}),
      metadata,
    })
  }
  return threadMessages
}
