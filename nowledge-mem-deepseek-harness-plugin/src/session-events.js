function errorMessage(error) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error)
}

function immutableEventSnapshot(value, source) {
  if (!Array.isArray(value)) {
    throw new TypeError(`nowledge-mem: ${source} must provide an event array`)
  }
  return Object.freeze([...value])
}

/**
 * Read one stable event snapshot for an entire import attempt.
 *
 * DSH 0.1.2 removed the public `events` array in favour of snapshotEvents().
 * Keep the array path only for older supported hosts, and never fall through
 * from a present-but-broken current API: doing so would hide a host contract
 * failure behind stale legacy state.
 */
export function snapshotSessionEvents(session) {
  if (typeof session?.snapshotEvents === 'function') {
    try {
      return immutableEventSnapshot(session.snapshotEvents(), 'DSH session.snapshotEvents()')
    } catch (error) {
      if (error instanceof TypeError && error.message.startsWith('nowledge-mem:')) throw error
      throw new TypeError(
        `nowledge-mem: DSH session.snapshotEvents() failed: ${errorMessage(error)}`,
        { cause: error },
      )
    }
  }
  if (Array.isArray(session?.events)) {
    return immutableEventSnapshot(session.events, 'legacy DSH session.events')
  }
  throw new TypeError(
    'nowledge-mem: unsupported DSH session event contract; expected session.snapshotEvents() or legacy session.events array',
  )
}
