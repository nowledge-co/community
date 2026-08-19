/**
 * Incremental session-capture helpers for the Amp connector.
 *
 * These functions implement the paired Mem checkpoint contract used by the
 * HTTP-native connectors (OpenCode, Pi): upload only the unacknowledged suffix,
 * bind appends to a content fingerprint, and refuse to advance the local cursor
 * until the server returns an explicit persistence acknowledgement.
 */

import { createHash } from "node:crypto"

/** Local cursor stored after a semantically acknowledged persist. */
export type AcknowledgedCursor = {
  /** Number of locally observed messages covered by this cursor. */
  readonly count: number
  /** Server-reported thread length at acknowledgement time. */
  readonly remoteCount: number
  /** External id of the last acknowledged message, when present. */
  readonly lastExternalId?: string
  /** Stable hash of the acknowledged prefix, used to detect in-place edits. */
  readonly prefixFingerprint: string
}

/** Result of comparing a local snapshot against the last acknowledged cursor. */
export type AcknowledgedDelta<T> = {
  /** Inclusive start index of the unacknowledged suffix. */
  readonly start: number
  /** Exclusive end index of the snapshot. */
  readonly end: number
  /** Messages that still need to be persisted. */
  readonly messages: T[]
  /** Cursor to store after a successful acknowledgement. */
  readonly next: AcknowledgedCursor
  /** Whether the previous prefix was invalid and a full replay is required. */
  readonly reset: boolean
}

/**
 * Builds a destination-lane key so cursor state never crosses spaces or servers.
 *
 * @param threadId - Host thread id.
 * @param apiUrl - Resolved Mem API URL.
 * @param apiKey - Optional API key.
 * @param spaceId - Ambient space id.
 * @param agentId - Ambient AI Identity.
 * @param hostAgentId - Optional host-agent alias.
 * @returns A stable lane key.
 */
export function sessionSyncLaneKey(
  threadId: string,
  apiUrl: string,
  apiKey: string | undefined,
  spaceId: string | undefined,
  agentId: string | undefined,
  hostAgentId: string | undefined,
): string {
  const destination = createHash("sha256")
    .update(JSON.stringify([apiUrl, apiKey ?? null, spaceId ?? null, agentId ?? null, hostAgentId ?? null]))
    .digest("hex")
  return `${destination}\0${threadId}`
}

/**
 * Returns a stable JSON fingerprint for a message value.
 *
 * @param message - Message to fingerprint.
 * @returns Canonical JSON for the message.
 */
export function stableMessageFingerprint(message: unknown): string {
  return JSON.stringify(message)
}

/**
 * Hashes the acknowledged prefix so same-length replacements are detected.
 *
 * @param messages - Complete local snapshot.
 * @param end - Exclusive end of the prefix.
 * @param messageFingerprint - Per-message fingerprint function.
 * @returns Hex-encoded SHA-256 digest of the prefix.
 */
function prefixFingerprint<T>(
  messages: readonly T[],
  end: number,
  messageFingerprint: (message: T) => string,
): string {
  const hash = createHash("sha256")
  for (const message of messages.slice(0, end)) {
    const value = messageFingerprint(message)
    hash.update(String(Buffer.byteLength(value)))
    hash.update(":")
    hash.update(value)
  }
  return hash.digest("hex")
}

/**
 * Detects a missing-thread response, including HTTP 400 `Thread not found`.
 *
 * @param status - HTTP status code.
 * @param data - Parsed response body.
 * @returns `true` when the server reported that the thread is missing.
 */
export function isThreadNotFoundResponse(status: number, data: unknown): boolean {
  if (
    typeof data === "object"
    && data !== null
    && (data as { error_code?: unknown }).error_code === "thread_not_found"
  ) {
    return true
  }
  if (status === 404) return true
  return JSON.stringify(data).toLowerCase().includes("thread not found")
}

/**
 * Detects a create-time "thread already exists" conflict.
 *
 * @param status - HTTP status code.
 * @param data - Parsed response body.
 * @returns `true` when the thread already exists in the destination space.
 */
export function isThreadAlreadyExistsResponse(status: number, data: unknown): boolean {
  if (status === 409) return true
  const text = JSON.stringify(data).toLowerCase()
  return (
    text.includes("thread already exists")
    || text.includes("already exists in space")
    || text.includes("already exists")
    || text.includes("thread exists")
  )
}

/**
 * Detects a checkpoint conflict that requires full reconciliation.
 *
 * @param data - Parsed response body.
 * @returns `true` when the server rejected the expected message count.
 */
export function isCheckpointConflictResponse(data: unknown): boolean {
  return (
    typeof data === "object"
    && data !== null
    && (data as { error_code?: unknown }).error_code === "checkpoint_conflict"
  )
}

/**
 * Validates an explicit checkpointed-append acknowledgement.
 *
 * @param data - Parsed response body.
 * @returns `true` when the server confirmed a checkpointed suffix write.
 */
export function isCheckpointedAppendAck(data: unknown): boolean {
  return (
    typeof data === "object"
    && data !== null
    && (data as { success?: unknown }).success === true
    && Number.isInteger((data as { messages_added?: unknown }).messages_added)
    && Number.isInteger((data as { total_messages?: unknown }).total_messages)
    && (data as { append_mode?: unknown }).append_mode === "checkpointed"
  )
}

/**
 * Reads the remote message count from a generic append acknowledgement.
 *
 * @param data - Parsed response body.
 * @returns The server-reported total, or `undefined` when the ack is incomplete.
 */
export function appendAcknowledgedRemoteCount(data: unknown): number | undefined {
  if (
    typeof data !== "object"
    || data === null
    || (data as { success?: unknown }).success !== true
    || !Number.isInteger((data as { messages_added?: unknown }).messages_added)
    || !Number.isInteger((data as { total_messages?: unknown }).total_messages)
  ) {
    return undefined
  }
  return (data as { total_messages: number }).total_messages
}

/**
 * Reads the remote message count from a create acknowledgement.
 *
 * @param data - Parsed response body.
 * @param expectedThreadId - Thread id that must match the created thread.
 * @returns The server-reported count, or `undefined` when the ack is incomplete.
 */
export function createAcknowledgedRemoteCount(
  data: unknown,
  expectedThreadId: string,
): number | undefined {
  if (typeof data !== "object" || data === null) return undefined
  const thread = (data as { thread?: unknown }).thread
  if (typeof thread !== "object" || thread === null) return undefined
  if ((thread as { thread_id?: unknown }).thread_id !== expectedThreadId) return undefined
  const messageCount = (thread as { message_count?: unknown }).message_count
  if (Number.isInteger(messageCount) && (messageCount as number) >= 0) {
    return messageCount as number
  }
  const messages = (data as { messages?: unknown }).messages
  return Array.isArray(messages) ? messages.length : undefined
}

/** Normalised HTTP response used by missing-thread recovery. */
export type ThreadSyncResponse = {
  /** Whether the request completed with a 2xx status. */
  readonly ok: boolean
  /** HTTP status code. */
  readonly status: number
  /** Parsed response body. */
  readonly data: unknown
}

/**
 * Recreates a thread after the server reports that it no longer exists.
 *
 * @param response - The failed persist response.
 * @param recreate - Callback that POSTs a complete create body.
 * @returns The original or recreated response, plus a recreation flag.
 */
export async function recreateMissingThread(
  response: ThreadSyncResponse,
  recreate: () => Promise<ThreadSyncResponse>,
): Promise<{ response: ThreadSyncResponse; recreated: boolean }> {
  if (response.ok || !isThreadNotFoundResponse(response.status, response.data)) {
    return { response, recreated: false }
  }
  return { response: await recreate(), recreated: true }
}

/**
 * Selects the unacknowledged suffix of a local snapshot.
 *
 * A cursor is trusted only when its count is in range, the last external id
 * still matches, and the prefix fingerprint is unchanged. Same-length and
 * earlier-prefix replacements therefore reset to a full replay.
 *
 * @param messages - Complete local snapshot.
 * @param cursor - Last acknowledged cursor, if any.
 * @param externalId - Extracts the stable external id from a message.
 * @param messageFingerprint - Optional content fingerprint; defaults to JSON.
 * @returns The suffix to upload and the cursor to store after acknowledgement.
 */
export function selectAcknowledgedDelta<T>(
  messages: readonly T[],
  cursor: AcknowledgedCursor | undefined,
  externalId: (message: T) => string,
  messageFingerprint: (message: T) => string = stableMessageFingerprint,
): AcknowledgedDelta<T> {
  let start = cursor?.count ?? 0
  let reset = false
  const acknowledgedPrefix =
    start >= 0 && start <= messages.length
      ? prefixFingerprint(messages, start, messageFingerprint)
      : ""
  if (
    start < 0
    || start > messages.length
    || (
      start > 0
      && (
        externalId(messages[start - 1] as T) !== cursor?.lastExternalId
        || acknowledgedPrefix !== cursor?.prefixFingerprint
      )
    )
  ) {
    start = 0
    reset = true
  }
  const end = messages.length
  return {
    start,
    end,
    messages: messages.slice(start),
    next: {
      count: end,
      remoteCount: cursor?.remoteCount ?? end,
      ...(end > 0 ? { lastExternalId: externalId(messages[end - 1] as T) } : {}),
      prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
    },
    reset,
  }
}
