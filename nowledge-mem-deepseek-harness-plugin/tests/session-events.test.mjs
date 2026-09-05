import assert from 'node:assert/strict'
import test from 'node:test'

import { snapshotSessionEvents } from '../src/session-events.js'

test('prefers one current snapshotEvents snapshot over legacy state', () => {
  const current = [{ type: 'user/message', seq: 2 }]
  let calls = 0
  const snapshot = snapshotSessionEvents({
    events: [{ type: 'user/message', seq: 1 }],
    snapshotEvents() {
      calls += 1
      return current
    },
  })

  current.push({ type: 'assistant/message', seq: 3 })
  assert.equal(calls, 1)
  assert.equal(Object.isFrozen(snapshot), true)
  assert.deepEqual(snapshot.map(event => event.seq), [2])
})

test('copies the legacy events array for older supported DSH hosts', () => {
  const legacy = [{ type: 'user/message', seq: 1 }]
  const snapshot = snapshotSessionEvents({ events: legacy })

  legacy.push({ type: 'assistant/message', seq: 2 })
  assert.equal(Object.isFrozen(snapshot), true)
  assert.deepEqual(snapshot.map(event => event.seq), [1])
})

test('rejects a missing event API instead of reporting an empty successful sync', () => {
  assert.throws(
    () => snapshotSessionEvents({}),
    /unsupported DSH session event contract; expected session\.snapshotEvents\(\) or legacy session\.events array/u,
  )
})

test('does not hide a broken current API behind a legacy fallback', () => {
  const failure = new Error('snapshot storage unavailable')
  assert.throws(
    () => snapshotSessionEvents({
      events: [],
      snapshotEvents() {
        throw failure
      },
    }),
    error => {
      assert.match(error.message, /session\.snapshotEvents\(\) failed: Error: snapshot storage unavailable/u)
      assert.equal(error.cause, failure)
      return true
    },
  )
})
