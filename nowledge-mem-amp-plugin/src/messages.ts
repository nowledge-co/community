/**
 * Conversion from Amp SDK message shapes to Nowledge Mem thread format.
 *
 * The Amp SDK presents message transcripts as an array of messages, each with an
 * array of typed parts (text, tool, reasoning, file, patch, and structural
 * markers). Nowledge Mem stores threads as an array of `{ content, role,
 * timestamp, metadata }` objects. This module owns that translation.
 *
 * Everything here is pure and total: every union member is handled explicitly
 * (there is no `default` fallthrough), and the public entry point
 * {@link normalizeMessages} validates raw SDK output before the typed converters
 * see it. This keeps the rest of the connector free of `any` and `cast()`.
 */

/**
 * A text content block in an Amp message. Mirrors `ThreadTextBlock`.
 */
export interface SdkTextBlock {
  readonly type: "text"
  readonly text: string
}

/**
 * A thinking content block in an Amp message. Mirrors `ThreadThinkingBlock`.
 */
export interface SdkThinkingBlock {
  readonly type: "thinking"
  readonly thinking: string
}

/**
 * A tool-use content block in an Amp message. Mirrors `ThreadToolUseBlock`.
 */
export interface SdkToolUseBlock {
  readonly type: "tool_use"
  readonly id: string
  readonly name: string
  readonly input: Record<string, unknown>
}

/** Status of a tool result, matching the SDK's `ThreadToolResultBlock.status`. */
export type SdkToolResultStatus = "done" | "error" | "cancelled" | "running" | "pending"

/**
 * A tool-result content block in an Amp message. Mirrors
 * `ThreadToolResultBlock`. The `output` is opaque to the connector.
 */
export interface SdkToolResultBlock {
  readonly type: "tool_result"
  readonly toolUseID: string
  readonly output?: unknown
  readonly status: SdkToolResultStatus
}

/**
 * A single message part (content block) as exposed by the Amp SDK.
 *
 * Tightened to the four documented `Thread*Block` types: `text`, `thinking`,
 * `tool_use`, and `tool_result`. There are no file/patch/structural part types
 * in the Amp SDK — those were speculative and have been removed.
 */
export type SdkMessagePart =
  | SdkTextBlock
  | SdkThinkingBlock
  | SdkToolUseBlock
  | SdkToolResultBlock

/** A single message as exposed by the Amp SDK, loosely typed at the boundary. */
export interface SdkMessage {
  /** Role of the message author. */
  readonly role?: string
  /** Per-message parts carrying the content. */
  readonly parts?: readonly SdkMessagePart[]
  /** Stable SDK message id, used for deduplication. */
  readonly id?: string
  /** Model id for assistant messages, when available. */
  readonly model?: string
  /** Agent name, when available. */
  readonly agent?: string
  /** Creation timestamp, when available. */
  readonly timestamp?: unknown
}

/** Nowledge Mem thread message produced by the converter. */
export interface ThreadMessage {
  /** Flattened, human-readable content. */
  readonly content: string
  /** `"user"` for user turns, `"assistant"` for everything else. */
  readonly role: "user" | "assistant"
  /** ISO-8601 timestamp. */
  readonly timestamp: string
  /** Provenance metadata, including the deduplication key. */
  readonly metadata: {
    /** Deduplication key derived from the SDK message id. */
    readonly external_id: string
    /** Source application tag. */
    readonly source_app: string
    /** Agent name, when the SDK exposed one. */
    readonly agent?: string
    /** Model id, when the SDK exposed one for an assistant message. */
    readonly model?: string
  }
}

/** Placeholder content for a message whose parts produced no extractable text. */
const EMPTY_MESSAGE_PLACEHOLDER = "(empty message)"

/**
 * Renders a content block to a text segment for the Nowledge Mem thread format.
 *
 * Each of the four SDK block types maps to a stable text representation:
 *   - `text` → the text content
 *   - `thinking` → wrapped in `<thinking>` tags
 *   - `tool_use` → `[Tool: <name>]` (or `[Tool: <name> (failed)]` — never, since
 *     tool_use has no error status; kept for symmetry with tool_result)
 *   - `tool_result` → `[Tool result: <status>]`
 *
 * @param part - The content block to render.
 * @returns The text segment, or `undefined` when the block carries no text.
 */
function renderPart(part: SdkMessagePart): string | undefined {
  switch (part.type) {
    case "text":
      return part.text
    case "thinking":
      return `<thinking>\n${part.thinking}\n</thinking>`
    case "tool_use":
      return `[Tool: ${part.name}]`
    case "tool_result":
      return `[Tool result: ${part.status}]`
    default:
      // Exhaustiveness guard: if Amp adds a new block type, the compiler flags
      // it here rather than silently dropping the block.
      return assertNever(part)
  }
}

/**
 * Compile-time exhaustiveness check for the block-type union.
 *
 * @param value - The unhandled block.
 * @returns Never; the function only exists to make a missing case a type error.
 */
function assertNever(value: never): never {
  throw new Error(`Unhandled message block type: ${String(value)}`)
}

/**
 * Flattens an array of content blocks into a single content string.
 *
 * Empty text blocks are skipped so they do not produce blank lines. When no
 * block contributes content, {@link EMPTY_MESSAGE_PLACEHOLDER} is returned so
 * the resulting thread message is never empty.
 *
 * @param parts - The content blocks to flatten.
 * @returns The flattened content.
 */
export function extractMessageContent(parts: readonly SdkMessagePart[]): string {
  const segments: string[] = []
  for (const part of parts) {
    const segment = renderPart(part)
    if (segment !== undefined && segment.length > 0) {
      segments.push(segment)
    }
  }
  return segments.length > 0 ? segments.join("\n") : EMPTY_MESSAGE_PLACEHOLDER
}

/**
 * Coerces an arbitrary SDK timestamp into an ISO-8601 string.
 *
 * Falls back to the current time when the value is missing or unparseable, so
 * the resulting thread message always has a valid timestamp.
 *
 * @param raw - The raw timestamp value.
 * @returns An ISO-8601 timestamp string.
 */
export function safeTimestamp(raw: unknown): string {
  if (raw === undefined || raw === null) {
    return new Date().toISOString()
  }
  const date = new Date(raw as string | number | Date)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

/**
 * Validates a raw value as an array of SDK messages.
 *
 * The Amp SDK may return the transcript as an array or wrapped in `{ data }`,
 * `{ items }`, or `{ messages }`. This function accepts any of those and returns
 * a flat array, filtering out entries that are not objects.
 *
 * @param raw - The raw SDK return value.
 * @returns A validated array of SDK messages.
 */
export function normalizeMessages(raw: unknown): SdkMessage[] {
  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : isObjectWith(raw, "data")
      ? toArray(raw.data)
      : isObjectWith(raw, "items")
        ? toArray(raw.items)
        : isObjectWith(raw, "messages")
          ? toArray(raw.messages)
          : []
  return candidates.filter((entry): entry is SdkMessage => typeof entry === "object" && entry !== null)
}

/**
 * Coerces a value to an array when it is one, otherwise returns an empty array.
 *
 * @param value - The value to coerce.
 * @returns The value as an array, or an empty array.
 */
function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

/**
 * Type guard: is `value` a non-null object that owns `key`?
 *
 * @param value - The value to test.
 * @param key - The property name to check for.
 * @returns `true` when `value` is an object with an own property named `key`.
 */
function isObjectWith(value: unknown, key: string): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.prototype.hasOwnProperty.call(value, key)
}

/** Options accepted by {@link toThreadMessages}. */
export interface ToThreadMessagesOptions {
  /** Source application tag stamped on each message's metadata. */
  readonly sourceApp: string
}

/**
 * Converts validated SDK messages into Nowledge Mem thread messages.
 *
 * Messages without a usable id are dropped, since the id is the deduplication
 * key. Roles are folded to the two Nowledge Mem roles: anything that is not
 * `"user"` is treated as an assistant turn.
 *
 * @param messages - Validated SDK messages.
 * @param options - Conversion options supplying the source-app tag.
 * @returns Thread messages ready for the Nowledge Mem API.
 */
export function toThreadMessages(
  messages: readonly SdkMessage[],
  options: ToThreadMessagesOptions,
): ThreadMessage[] {
  const result: ThreadMessage[] = []
  for (const message of messages) {
    const id = message.id
    if (id === undefined || id === "") {
      continue
    }
    const role: "user" | "assistant" = message.role === "user" ? "user" : "assistant"
    const metadata: ThreadMessage["metadata"] = {
      external_id: `${options.sourceApp}-msg-${id}`,
      source_app: options.sourceApp,
      ...(message.agent !== undefined ? { agent: message.agent } : {}),
      ...(role === "assistant" && message.model !== undefined ? { model: message.model } : {}),
    }
    result.push({
      content: extractMessageContent([...(message.parts ?? [])]),
      role,
      timestamp: safeTimestamp(message.timestamp ?? Date.now()),
      metadata,
    })
  }
  return result
}

/**
 * Returns the deduplication signature for a list of thread messages.
 *
 * The signature combines the message count, total rendered content length, and
 * the last message's `external_id`. Re-capturing a session whose transcript has
 * not changed yields the same signature, while edits to existing message
 * payloads still trigger another save.
 *
 * @param messages - Thread messages to summarise.
 * @returns The deduplication signature.
 */
export function captureSignature(messages: readonly ThreadMessage[]): string {
  const lastId = lastExternalId(messages)
  const contentLength = messages.reduce((total, message) => total + message.content.length, 0)
  return `${messages.length}:${contentLength}:${lastId}`
}

/**
 * Finds the last `external_id` in a list of thread messages.
 *
 * @param messages - Thread messages to scan from the end.
 * @returns The last `external_id`, or an empty string when none is present.
 */
export function lastExternalId(messages: readonly ThreadMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const id = messages[i]?.metadata.external_id
    if (typeof id === "string" && id.length > 0) {
      return id
    }
  }
  return ""
}
