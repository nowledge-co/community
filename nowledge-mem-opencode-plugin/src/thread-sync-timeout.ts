const DEFAULT_THREAD_SYNC_TIMEOUT_MS = 120_000
const MIN_THREAD_SYNC_TIMEOUT_MS = 1_000
const MAX_THREAD_SYNC_TIMEOUT_MS = 30 * 60_000

export function resolveThreadSyncTimeoutMs(raw: string | undefined): number {
  const parsed = Number(raw)
  if (!raw?.trim() || !Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_THREAD_SYNC_TIMEOUT_MS
  }
  return Math.min(MAX_THREAD_SYNC_TIMEOUT_MS, Math.max(MIN_THREAD_SYNC_TIMEOUT_MS, parsed))
}
