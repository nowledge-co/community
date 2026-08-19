import { createHash } from "node:crypto"

export type AcknowledgedCursor = {
  count: number
  remoteCount: number
  lastExternalId?: string
  prefixFingerprint: string
}

export type AcknowledgedDelta<T> = {
  start: number
  end: number
  messages: T[]
  next: AcknowledgedCursor
  reset: boolean
}

export function sessionSyncLaneKey(sessionId: string, spaceId?: string): string {
  return `${spaceId ?? ""}\0${sessionId}`
}

export function stableMessageFingerprint(message: unknown): string {
  return JSON.stringify(message)
}

export function normalizedTimestamp(raw: unknown): string | undefined {
  if (raw === null || raw === undefined) return undefined
  try {
    const timestamp = new Date(raw as any)
    return Number.isNaN(timestamp.getTime()) ? undefined : timestamp.toISOString()
  } catch {
    return undefined
  }
}

function prefixFingerprint<T>(
  messages: T[],
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

export function isThreadNotFoundResponse(status: number, data: unknown): boolean {
  if (
    typeof data === "object" &&
    data !== null &&
    (data as { error_code?: unknown }).error_code === "thread_not_found"
  ) return true
  if (status === 404) return true
  return JSON.stringify(data).toLowerCase().includes("thread not found")
}

export function isThreadAlreadyExistsResponse(status: number, data: unknown): boolean {
  if (status === 409) return true
  const text = JSON.stringify(data).toLowerCase()
  return text.includes("thread already exists") || text.includes("already exists in space")
}

export function isCheckpointConflictResponse(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { error_code?: unknown }).error_code === "checkpoint_conflict"
  )
}

export function isCheckpointedAppendAck(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { success?: unknown }).success === true &&
    Number.isInteger((data as { messages_added?: unknown }).messages_added) &&
    Number.isInteger((data as { total_messages?: unknown }).total_messages) &&
    (data as { append_mode?: unknown }).append_mode === "checkpointed"
  )
}

export function appendAcknowledgedRemoteCount(data: unknown): number | undefined {
  if (
    typeof data !== "object" ||
    data === null ||
    (data as { success?: unknown }).success !== true ||
    !Number.isInteger((data as { messages_added?: unknown }).messages_added) ||
    !Number.isInteger((data as { total_messages?: unknown }).total_messages)
  ) return undefined
  return (data as { total_messages: number }).total_messages
}

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

export type ThreadSyncResponse = {
  ok: boolean
  status: number
  data: unknown
}

export async function recreateMissingThread(
  response: ThreadSyncResponse,
  recreate: () => Promise<ThreadSyncResponse>,
): Promise<{ response: ThreadSyncResponse; recreated: boolean }> {
  if (response.ok || !isThreadNotFoundResponse(response.status, response.data)) {
    return { response, recreated: false }
  }
  return { response: await recreate(), recreated: true }
}

export function selectAcknowledgedDelta<T>(
  messages: T[],
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
    start < 0 ||
    start > messages.length ||
    (start > 0 &&
      (externalId(messages[start - 1]) !== cursor?.lastExternalId ||
        acknowledgedPrefix !== cursor?.prefixFingerprint))
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
      ...(end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {}),
      prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
    },
    reset,
  }
}
