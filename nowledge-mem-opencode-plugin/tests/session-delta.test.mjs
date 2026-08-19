import assert from "node:assert/strict"
import test from "node:test"

import {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  isThreadAlreadyExistsResponse,
  normalizedTimestamp,
  isThreadNotFoundResponse,
  recreateMissingThread,
  selectAcknowledgedDelta,
  sessionSyncLaneKey,
} from "../src/session-delta.ts"

const id = (message) => message.id

test("selects only messages after the acknowledged anchor", () => {
  const messages = [{ id: "a" }, { id: "b" }, { id: "c" }]
  const initial = selectAcknowledgedDelta(messages.slice(0, 2), undefined, id).next
  const delta = selectAcknowledgedDelta(messages, initial, id)
  assert.deepEqual(delta.messages, [{ id: "c" }])
  assert.equal(delta.next.count, 3)
  assert.equal(delta.next.lastExternalId, "c")
  assert.equal(delta.reset, false)
})

test("replays safely when compaction replaces the acknowledged prefix", () => {
  const messages = [{ id: "new-a" }, { id: "new-b" }]
  const cursor = selectAcknowledgedDelta([{ id: "old-a" }], undefined, id).next
  const delta = selectAcknowledgedDelta(messages, cursor, id)
  assert.deepEqual(delta.messages, messages)
  assert.equal(delta.start, 0)
  assert.equal(delta.reset, true)
})

test("an unchanged snapshot produces an empty delta", () => {
  const messages = [{ id: "a" }, { id: "b" }]
  const cursor = selectAcknowledgedDelta(messages, undefined, id).next
  const delta = selectAcknowledgedDelta(messages, cursor, id)
  assert.deepEqual(delta.messages, [])
  assert.deepEqual(delta.next, cursor)
})

test("resets when an earlier message changes but the final anchor is unchanged", () => {
  const original = [{ id: "a", content: "old" }, { id: "b", content: "same" }]
  const cursor = selectAcknowledgedDelta(original, undefined, id).next
  const changed = [{ id: "a", content: "new" }, { id: "b", content: "same" }]
  const delta = selectAcknowledgedDelta(changed, cursor, id)
  assert.equal(delta.reset, true)
  assert.deepEqual(delta.messages, changed)
})

test("recognizes missing-thread and checkpoint acknowledgements", () => {
  assert.equal(isThreadNotFoundResponse(400, { detail: "Thread not found: opencode-x" }), true)
  assert.equal(isThreadNotFoundResponse(400, { error_code: "thread_not_found" }), true)
  assert.equal(isThreadNotFoundResponse(500, { detail: "other" }), false)
  assert.equal(
    isCheckpointedAppendAck({
      success: true,
      append_mode: "checkpointed",
      messages_added: 1,
      total_messages: 3,
    }),
    true,
  )
  assert.equal(isCheckpointedAppendAck({ append_mode: "checkpointed" }), false)
  assert.equal(isCheckpointedAppendAck({ success: true }), false)
  assert.equal(
    isThreadAlreadyExistsResponse(422, { detail: "Thread opencode-x already exists in space default" }),
    true,
  )
  assert.equal(
    createAcknowledgedRemoteCount({ thread: { thread_id: "opencode-x", message_count: 5 } }, "opencode-x"),
    5,
  )
  assert.equal(createAcknowledgedRemoteCount({ thread: { message_count: 5 } }, "opencode-x"), undefined)
  assert.equal(
    createAcknowledgedRemoteCount({ thread: { thread_id: "other", message_count: 5 } }, "opencode-x"),
    undefined,
  )
})

test("omits invalid synthesized timestamps from checkpoint input", () => {
  assert.equal(normalizedTimestamp(undefined), undefined)
  assert.equal(normalizedTimestamp(null), undefined)
  assert.equal(normalizedTimestamp("not-a-date"), undefined)
  assert.equal(normalizedTimestamp(0), "1970-01-01T00:00:00.000Z")
})

test("rebuilds the remote count after checkpoint conflict reconciliation", () => {
  const first = [{ id: "a" }, { id: "b" }]
  const initial = selectAcknowledgedDelta(first, undefined, id).next
  assert.equal(initial.remoteCount, 2)
  assert.equal(isCheckpointConflictResponse({ error_code: "checkpoint_conflict" }), true)

  const reconciledRemoteCount = appendAcknowledgedRemoteCount({
    success: true,
    messages_added: 0,
    total_messages: 5,
    append_mode: "deduplicated",
  })
  const reconciled = { ...initial, remoteCount: reconciledRemoteCount }
  const next = selectAcknowledgedDelta([...first, { id: "c" }], reconciled, id)
  assert.deepEqual(next.messages, [{ id: "c" }])
  assert.equal(next.next.remoteCount, 5)
})

test("recreates the complete Thread after a 400 missing-thread response", async () => {
  const createBodies = []
  const createBody = { thread_id: "opencode-x", messages: [{ content: "complete history" }] }
  const recovered = await recreateMissingThread(
    { ok: false, status: 400, data: { detail: "Thread not found: opencode-x" } },
    async () => {
      createBodies.push(createBody)
      return { ok: true, status: 201, data: { thread_id: "opencode-x" } }
    },
  )
  assert.equal(recovered.recreated, true)
  assert.equal(recovered.response.ok, true)
  assert.deepEqual(createBodies, [createBody])
})

test("session checkpoints are isolated by destination lane", () => {
  const base = ["https://mem", "key", "space-a", "agent-a", undefined]
  assert.notEqual(
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-a", undefined, undefined),
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-b", undefined, undefined),
  )
  assert.notEqual(
    sessionSyncLaneKey("session-1", "https://mem-a", "key", "space", undefined, undefined),
    sessionSyncLaneKey("session-1", "https://mem-b", "key", "space", undefined, undefined),
  )
  assert.notEqual(
    sessionSyncLaneKey("session-1", "https://mem", "key-a", "space", undefined, undefined),
    sessionSyncLaneKey("session-1", "https://mem", "key-b", "space", undefined, undefined),
  )
  assert.notEqual(
    sessionSyncLaneKey("session-1", ...base),
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-a", "agent-b", undefined),
  )
  assert.notEqual(
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-a", undefined, "host-a"),
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-a", undefined, "host-b"),
  )
  assert.equal(
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-a", "agent-a", "host-a"),
    sessionSyncLaneKey("session-1", "https://mem", "key", "space-a", "agent-a", "host-a"),
  )
})
