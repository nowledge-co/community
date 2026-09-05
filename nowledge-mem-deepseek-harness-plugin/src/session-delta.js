const SURFACE_EVENT_TYPES = new Set([
  'user/message',
  'assistant/message',
  'tool/result',
])

export function selectUnacknowledgedEvents(events, acknowledgedSeq = -1) {
  const surface = events.filter(event => SURFACE_EVENT_TYPES.has(event.type))
  const anchorPresent = acknowledgedSeq < 0 || surface.some(event => event.seq === acknowledgedSeq)
  const reset = acknowledgedSeq >= 0 && !anchorPresent
  const effectiveSeq = reset ? -1 : acknowledgedSeq
  const selected = surface.filter(event => event.seq > effectiveSeq)
  const nextSeq = selected.reduce(
    (highest, event) => Math.max(highest, event.seq),
    effectiveSeq,
  )
  return { events: selected, nextSeq, reset }
}

export function importAcknowledgement(stdout, checkpointed) {
  let data
  try {
    data = JSON.parse(stdout)
  } catch {
    return { status: 'failed' }
  }
  if (data === null || typeof data !== 'object') return { status: 'failed' }
  const results = Array.isArray(data.results) ? data.results : []
  const recoverable = results.some(result =>
    result?.error_code === 'checkpoint_conflict' || result?.error_code === 'thread_not_found'
  )
  if (recoverable) return { status: 'conflict' }
  if (
    data.success !== true ||
    Number(data.failed_count ?? 0) > 0 ||
    results.length === 0 ||
    results.some(result => result?.success !== true)
  ) return { status: 'failed' }
  if (checkpointed && results[0]?.append_mode !== 'checkpointed') return { status: 'failed' }
  const messageCount = results[0]?.message_count
  if (!Number.isInteger(messageCount) || messageCount < 0) return { status: 'failed' }
  return { status: 'acknowledged', messageCount }
}

export function importAcknowledged(stdout, checkpointed) {
  return importAcknowledgement(stdout, checkpointed).status === 'acknowledged'
}

/**
 * Classify the CLI process and its structured import response together.
 * `nmem t import` reports checkpoint drift as JSON on stdout with a non-zero
 * exit code. That one typed failure is recoverable; every other process-level
 * failure remains a failure even if its payload happens to say success.
 */
export function importResultAcknowledgement(result, checkpointed) {
  if (
    result === undefined
    || result.signal !== null
    || result.timedOut
    || result.aborted
  ) return { status: 'failed' }
  const stdout = result.stdout?.text?.trim()
  if (stdout === undefined || stdout === '') return { status: 'failed' }
  const acknowledgement = importAcknowledgement(stdout, checkpointed)
  if (result.exitCode === 0 || acknowledgement.status === 'conflict') {
    return acknowledgement
  }
  return { status: 'failed' }
}
