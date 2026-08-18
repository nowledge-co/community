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
