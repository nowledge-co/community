import assert from 'node:assert/strict'
import test from 'node:test'

import { importAcknowledged, selectUnacknowledgedEvents } from '../src/session-delta.js'

const events = [
  { type: 'session/start', seq: 1 },
  { type: 'user/message', seq: 2 },
  { type: 'assistant/message', seq: 3 },
  { type: 'turn/end', seq: 4 },
  { type: 'tool/result', seq: 5 },
]

test('selects only surface events after the acknowledged sequence', () => {
  const delta = selectUnacknowledgedEvents(events, 3)
  assert.deepEqual(delta.events.map(event => event.seq), [5])
  assert.equal(delta.nextSeq, 5)
  assert.equal(delta.reset, false)
})

test('replays surface events when compaction removes the anchor', () => {
  const compacted = [
    { type: 'user/message', seq: 10 },
    { type: 'assistant/message', seq: 11 },
  ]
  const delta = selectUnacknowledgedEvents(compacted, 3)
  assert.deepEqual(delta.events.map(event => event.seq), [10, 11])
  assert.equal(delta.nextSeq, 11)
  assert.equal(delta.reset, true)
})

test('an exact replay has no delta', () => {
  const delta = selectUnacknowledgedEvents(events, 5)
  assert.deepEqual(delta.events, [])
  assert.equal(delta.nextSeq, 5)
})

test('requires semantic success before acknowledging an import', () => {
  assert.equal(importAcknowledged(JSON.stringify({}), false), false)
  assert.equal(
    importAcknowledged(
      JSON.stringify({ success: false, failed_count: 1, results: [{ success: false }] }),
      false,
    ),
    false,
  )
  assert.equal(
    importAcknowledged(
      JSON.stringify({
        success: false,
        failed_count: 0,
        results: [{ success: true, append_mode: 'checkpointed' }],
      }),
      true,
    ),
    false,
  )
  assert.equal(
    importAcknowledged(
      JSON.stringify({ success: true, failed_count: 0, results: [{ success: true }] }),
      false,
    ),
    true,
  )
  assert.equal(
    importAcknowledged(
      JSON.stringify({
        success: true,
        failed_count: 0,
        results: [{ success: true, append_mode: 'checkpointed' }],
      }),
      true,
    ),
    true,
  )
  assert.equal(
    importAcknowledged(JSON.stringify({ success: true, results: [{ success: true }] }), true),
    false,
  )
})
