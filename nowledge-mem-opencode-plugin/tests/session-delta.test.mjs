import assert from "node:assert/strict"
import test from "node:test"

import {
  selectAcknowledgedDelta,
  sessionSyncLaneKey,
} from "../src/session-delta.ts"

const id = (message) => message.id

test("selects only messages after the acknowledged anchor", () => {
  const messages = [{ id: "a" }, { id: "b" }, { id: "c" }]
  const delta = selectAcknowledgedDelta(messages, { count: 2, lastExternalId: "b" }, id)
  assert.deepEqual(delta.messages, [{ id: "c" }])
  assert.deepEqual(delta.next, { count: 3, lastExternalId: "c" })
  assert.equal(delta.reset, false)
})

test("replays safely when compaction replaces the acknowledged prefix", () => {
  const messages = [{ id: "new-a" }, { id: "new-b" }]
  const delta = selectAcknowledgedDelta(messages, { count: 1, lastExternalId: "old-a" }, id)
  assert.deepEqual(delta.messages, messages)
  assert.equal(delta.start, 0)
  assert.equal(delta.reset, true)
})

test("an unchanged snapshot produces an empty delta", () => {
  const messages = [{ id: "a" }, { id: "b" }]
  const delta = selectAcknowledgedDelta(messages, { count: 2, lastExternalId: "b" }, id)
  assert.deepEqual(delta.messages, [])
  assert.deepEqual(delta.next, { count: 2, lastExternalId: "b" })
})

test("session checkpoints are isolated by destination space", () => {
  assert.notEqual(
    sessionSyncLaneKey("session-1", "space-a"),
    sessionSyncLaneKey("session-1", "space-b"),
  )
  assert.equal(
    sessionSyncLaneKey("session-1", "space-a"),
    sessionSyncLaneKey("session-1", "space-a"),
  )
})
