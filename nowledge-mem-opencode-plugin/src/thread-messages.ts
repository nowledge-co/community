import { normalizedTimestamp } from "./session-delta.ts"

/**
 * Pure transform from OpenCode v2 session messages (`ctx.session.context`) to
 * Nowledge Mem thread messages.
 *
 * OpenCode v2 returns flat, tagged message objects rather than the v1
 * `{ info, parts }` columns, so this lives beside `session-delta` as plain,
 * dependency-free logic that stays unit-testable without an OpenCode host.
 */

export type ThreadMessage = {
  content: string
  role: "user" | "assistant"
  timestamp?: string
  metadata: {
    external_id: string
    source_app: "opencode"
    agent?: string
    model?: string
  }
}

type SessionTextPart = { type: "text"; text?: string }
type SessionReasoningPart = { type: "reasoning"; text?: string }
type SessionToolPart = {
  type: "tool"
  name?: string
  state?: {
    status?: string
    /** An object once parsed; the partial argument string while streaming. */
    input?: unknown
    content?: Array<{ type?: string; text?: string }>
    metadata?: Record<string, unknown>
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

/** Counts code points, as the Rust importer's `chars().take(n)` does. */
function clip(text: string, limit: number): string {
  const chars = Array.from(text)
  return chars.length > limit ? `${chars.slice(0, limit).join("")}...` : text
}

function stringField(fields: Record<string, unknown>, key: string): string {
  const value = fields[key]
  return typeof value === "string" ? value : ""
}

function summarizeToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object" || Array.isArray(input)) return ""
  const fields = input as Record<string, unknown>
  switch (name) {
    case "bash": {
      const command = stringField(fields, "command")
      return command ? `$ ${clip(command, 200)}` : stringField(fields, "description")
    }
    case "read": {
      const filePath = stringField(fields, "filePath")
      return filePath ? `File: ${filePath}` : ""
    }
    case "glob": {
      const pattern = stringField(fields, "pattern")
      return pattern ? `Pattern: ${pattern}` : ""
    }
    case "grep": {
      const pattern = stringField(fields, "pattern")
      if (!pattern) return ""
      const path = stringField(fields, "path")
      return path ? `Pattern: ${pattern} in ${path}` : `Pattern: ${pattern}`
    }
    case "webfetch": {
      const url = stringField(fields, "url")
      return url ? `URL: ${url}` : ""
    }
    case "task": {
      const description = stringField(fields, "description")
      return description ? `Task: ${description}` : ""
    }
    default:
      return ""
  }
}

function toolAnnotations(name: string, metadata: Record<string, unknown> | undefined): string {
  if (!metadata) return ""
  const notes: string[] = []
  if (name === "bash" && metadata.exit != null && metadata.exit !== 0) notes.push(`exit=${metadata.exit}`)
  if (name === "grep") {
    if (metadata.matches != null) notes.push(`${metadata.matches} matches`)
    if (metadata.truncated === true) notes.push("truncated")
  }
  if (name === "glob" && metadata.count != null) notes.push(`${metadata.count} files`)
  return notes.length ? `(${notes.join(", ")})` : ""
}

/**
 * Mirrors `format_opencode_tool_part` in nmem-sessions, with the same bounds,
 * so live capture and `nmem t sync --from opencode` write the same tool lines.
 * v2 has no `title`/`output`: output comes from the result's text content.
 */
function formatToolPart(part: SessionToolPart): string {
  const name = part.name ?? "unknown"
  const state = part.state
  let line = `[Tool: ${name}${state?.status === "error" ? " (failed)" : ""}]`
  if (!state) return line

  const summary = summarizeToolInput(name, state.input)
  if (summary) line += ` ${summary}`
  const annotations = toolAnnotations(name, state.metadata)
  if (annotations) line += ` ${annotations}`

  if (state.status === "error") {
    const message = state.error?.message ?? ""
    return message ? `${line} — Error: ${Array.from(message).slice(0, 200).join("")}` : line
  }
  if (name === "bash" && state.status === "completed") {
    const output = (state.content ?? [])
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim()
    if (output) return `${line}\n${clip(output, 500)}`
  }
  return line
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
      case "tool":
        segments.push(formatToolPart(part))
        break
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
