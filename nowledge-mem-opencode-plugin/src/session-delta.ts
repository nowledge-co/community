import { createHash } from "node:crypto"

export type AcknowledgedCursor = {
  count: number
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
  if (status === 404) return true
  return JSON.stringify(data).toLowerCase().includes("thread not found")
}

export function isCheckpointedAppendAck(data: unknown): boolean {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { append_mode?: unknown }).append_mode === "checkpointed"
  )
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
      ...(end > 0 ? { lastExternalId: externalId(messages[end - 1]) } : {}),
      prefixFingerprint: prefixFingerprint(messages, end, messageFingerprint),
    },
    reset,
  }
}
