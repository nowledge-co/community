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
type SessionToolPart = { type: "tool"; name?: string; state?: { status?: string } }
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
