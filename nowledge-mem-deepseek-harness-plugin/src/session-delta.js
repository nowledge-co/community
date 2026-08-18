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

export function importAcknowledged(stdout, checkpointed) {
  let data
  try {
    data = JSON.parse(stdout)
  } catch {
    return false
  }
  if (data === null || typeof data !== 'object') return false
  if (data.success === false || Number(data.failed_count ?? 0) > 0) return false
  const results = Array.isArray(data.results) ? data.results : []
  if (results.some(result => result?.success === false)) return false
  if (!checkpointed) return true
  return results.length > 0 && results[0]?.append_mode === 'checkpointed'
}
