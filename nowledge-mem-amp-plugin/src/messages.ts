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

/** Discriminator value for a structural marker part that carries no content. */
type StructuralPartType =
  | "step-start"
  | "step-finish"
  | "snapshot"
  | "compaction"
  | "retry"
  | "agent"
  | "subtask"

/** Discriminator value for a content-bearing part. */
type ContentPartType = "text" | "tool" | "reasoning" | "file" | "patch"

/** Union of every part type the converter recognises. */
type PartType = ContentPartType | StructuralPartType

/** Discriminator value used when a part omits `type` or sets an unknown value. */
type UnknownPartType = undefined

/** A single message part as exposed by the Amp SDK. */
export interface SdkMessagePart {
  /** Discriminator identifying the part kind; absent for unknown SDK shapes. */
  readonly type?: PartType | UnknownPartType
  /** Free-form content for text/reasoning parts. */
  readonly content?: string
  /** Alternative content field used by some SDK shapes. */
  readonly text?: string
  /** Tool name for tool parts. */
  readonly tool?: string
  /** Alternative tool-name field used by some SDK shapes. */
  readonly name?: string
  /** State for tool parts; `"error"` marks a failed tool call. */
  readonly state?: string
  /** Filename for file parts. */
  readonly filename?: string
  /** Alternative filename/path field used by some SDK shapes. */
  readonly path?: string
}

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
 * Extracts a single text segment from a part, tolerating either `content` or
 * `text` field names used by different SDK shapes.
 *
 * @param part - The part to read.
 * @returns The text, or `undefined` when the part carries no text.
 */
function readText(part: SdkMessagePart): string | undefined {
  return part.content || part.text || undefined
}

/**
 * Renders a content-bearing part to a text segment.
 *
 * @param part - The part to render.
 * @returns The text segment, or `undefined` when the part is structural.
 */
function renderPart(part: SdkMessagePart): string | undefined {
  const type = part.type
  switch (type) {
    case "text": {
      const text = readText(part)
      return text === undefined ? undefined : text
    }
    case "tool": {
      const name = part.tool || part.name || "unknown"
      const suffix = part.state === "error" ? " (failed)" : ""
      return `[Tool: ${name}${suffix}]`
    }
    case "reasoning": {
      const reasoning = readText(part)
      return reasoning === undefined ? undefined : `<thinking>\n${reasoning}\n</thinking>`
    }
    case "file":
      return `[File: ${part.filename ?? part.path ?? "attachment"}]`
    case "patch":
      return `[Patch: ${part.path ?? "file change"}]`
    case "step-start":
    case "step-finish":
    case "snapshot":
    case "compaction":
    case "retry":
    case "agent":
    case "subtask":
      return undefined
    case undefined:
      // Parts without a recognised `type` carry no content the connector can
      // serialise; drop them rather than guessing.
      return undefined
    default:
      // Exhaustiveness guard: if Amp adds a new part type, the compiler flags
      // it here rather than silently dropping the part.
      return assertNever(type)
  }
}

/**
 * Compile-time exhaustiveness check for the part-type union.
 *
 * @param value - The unhandled discriminator.
 * @returns Never; the function only exists to make a missing case a type error.
 */
function assertNever(value: never): never {
  throw new Error(`Unhandled message part type: ${String(value)}`)
}

/**
 * Flattens an array of parts into a single content string.
 *
 * Structural parts (step markers, snapshots, etc.) are dropped. When no part
 * contributes content, {@link EMPTY_MESSAGE_PLACEHOLDER} is returned so the
 * resulting thread message is never empty.
 *
 * @param parts - The parts to flatten.
 * @returns The flattened content.
 */
export function extractMessageContent(parts: readonly SdkMessagePart[]): string {
  const segments: string[] = []
  for (const part of parts) {
    const segment = renderPart(part)
    if (segment !== undefined) {
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
 * The signature combines the message count with the last message's
 * `external_id`. Re-capturing a session whose transcript has not changed yields
 * the same signature, which lets the capture manager skip redundant uploads.
 *
 * @param messages - Thread messages to summarise.
 * @returns The deduplication signature.
 */
export function captureSignature(messages: readonly ThreadMessage[]): string {
  const lastId = lastExternalId(messages)
  return `${messages.length}:${lastId}`
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
