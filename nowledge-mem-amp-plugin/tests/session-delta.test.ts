import { describe, expect, it } from "vitest"

import {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  isCheckpointConflictResponse,
  isCheckpointedAppendAck,
  isThreadAlreadyExistsResponse,
  isThreadNotFoundResponse,
  recreateMissingThread,
  selectAcknowledgedDelta,
  sessionSyncLaneKey,
  stableMessageFingerprint,
} from "../src/session-delta"

const id = (message: { readonly id: string }) => message.id

describe("selectAcknowledgedDelta", () => {
  it("selects only the unacknowledged suffix", () => {
    const messages = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const cursor = selectAcknowledgedDelta(messages.slice(0, 2), undefined, id).next
    const delta = selectAcknowledgedDelta(messages, cursor, id)
    expect(delta.messages).toEqual([{ id: "c" }])
    expect(delta.next.count).toBe(3)
    expect(delta.next.lastExternalId).toBe("c")
    expect(delta.reset).toBe(false)
  })

  it("resets when a compacted branch no longer contains the anchor", () => {
    const messages = [{ id: "new-a" }, { id: "new-b" }]
    const cursor = selectAcknowledgedDelta([{ id: "old-a" }], undefined, id).next
    const delta = selectAcknowledgedDelta(messages, cursor, id)
    expect(delta.messages).toEqual(messages)
    expect(delta.start).toBe(0)
    expect(delta.reset).toBe(true)
  })

  it("returns no work for an exact replay", () => {
    const messages = [{ id: "a" }, { id: "b" }]
    const cursor = selectAcknowledgedDelta(messages, undefined, id).next
    const delta = selectAcknowledgedDelta(messages, cursor, id)
    expect(delta.messages).toEqual([])
    expect(delta.next).toEqual(cursor)
  })

  it("resets when an earlier message changes but the final anchor is unchanged", () => {
    const original = [{ id: "a", content: "old" }, { id: "b", content: "same" }]
    const cursor = selectAcknowledgedDelta(original, undefined, id).next
    const changed = [{ id: "a", content: "new" }, { id: "b", content: "same" }]
    const delta = selectAcknowledgedDelta(changed, cursor, id)
    expect(delta.reset).toBe(true)
    expect(delta.messages).toEqual(changed)
  })

  it("omits lastExternalId for an empty snapshot", () => {
    const delta = selectAcknowledgedDelta([], undefined, id)
    expect(delta.messages).toEqual([])
    expect(delta.next.lastExternalId).toBeUndefined()
    expect(delta.next.count).toBe(0)
  })

  it("resets when the cursor count is out of range", () => {
    const messages = [{ id: "a" }]
    const delta = selectAcknowledgedDelta(messages, {
      count: 4,
      remoteCount: 4,
      lastExternalId: "missing",
      prefixFingerprint: "nope",
    }, id)
    expect(delta.reset).toBe(true)
    expect(delta.start).toBe(0)
  })
})

describe("sessionSyncLaneKey", () => {
  it("isolates cursor state by the complete destination lane", () => {
    const first = sessionSyncLaneKey("thread", "https://mem", "key", "space-a", "agent", "host")
    const second = sessionSyncLaneKey("thread", "https://mem", "key", "space-b", "agent", "host")
    expect(first).not.toBe(second)
    expect(first).toBe(sessionSyncLaneKey("thread", "https://mem", "key", "space-a", "agent", "host"))
  })
})

describe("acknowledgement helpers", () => {
  it("requires an explicit checkpoint acknowledgement", () => {
    expect(isCheckpointedAppendAck({
      success: true,
      append_mode: "checkpointed",
      messages_added: 1,
      total_messages: 3,
    })).toBe(true)
    expect(isCheckpointedAppendAck({ append_mode: "checkpointed" })).toBe(false)
    expect(isCheckpointedAppendAck({ success: false, append_mode: "checkpointed" })).toBe(false)
    expect(isCheckpointedAppendAck({ success: true })).toBe(false)
  })

  it("validates create and append acknowledgements", () => {
    expect(appendAcknowledgedRemoteCount({ success: true, messages_added: 1, total_messages: 3 })).toBe(3)
    expect(appendAcknowledgedRemoteCount({})).toBeUndefined()
    expect(createAcknowledgedRemoteCount({ thread: { thread_id: "amp-x", message_count: 5 } }, "amp-x")).toBe(5)
    expect(createAcknowledgedRemoteCount({ thread: { thread_id: "amp-x" }, messages: [{}, {}] }, "amp-x")).toBe(2)
    expect(createAcknowledgedRemoteCount({ thread: { thread_id: "amp-x" }, messages: "nope" }, "amp-x")).toBeUndefined()
    expect(createAcknowledgedRemoteCount({ thread: { thread_id: "other", message_count: 5 } }, "amp-x")).toBeUndefined()
    expect(createAcknowledgedRemoteCount({ thread: {} }, "amp-x")).toBeUndefined()
    expect(createAcknowledgedRemoteCount(null, "amp-x")).toBeUndefined()
    expect(createAcknowledgedRemoteCount({ success: true }, "amp-x")).toBeUndefined()
  })

  it("recognizes missing-thread, already-exists, and checkpoint-conflict responses", () => {
    expect(isThreadNotFoundResponse(400, { detail: "Thread not found: amp-x" })).toBe(true)
    expect(isThreadNotFoundResponse(400, { error_code: "thread_not_found" })).toBe(true)
    expect(isThreadNotFoundResponse(404, { detail: "missing" })).toBe(true)
    expect(isThreadNotFoundResponse(500, { detail: "other" })).toBe(false)
    expect(isThreadAlreadyExistsResponse(409, {})).toBe(true)
    expect(isThreadAlreadyExistsResponse(422, { detail: "Thread amp-x already exists in space default" })).toBe(true)
    expect(isThreadAlreadyExistsResponse(422, { detail: "unrelated" })).toBe(false)
    expect(isThreadAlreadyExistsResponse(422, { error: { message: "Thread exists in space default." } })).toBe(true)
    expect(isCheckpointConflictResponse({ error_code: "checkpoint_conflict" })).toBe(true)
    expect(isCheckpointConflictResponse({ error_code: "other" })).toBe(false)
  })

  it("preserves the reconciled remote count for the next suffix", () => {
    const first = [{ id: "a" }, { id: "b" }]
    const initial = selectAcknowledgedDelta(first, undefined, id).next
    const reconciled = { ...initial, remoteCount: 5 }
    const next = selectAcknowledgedDelta([...first, { id: "c" }], reconciled, id)
    expect(next.messages).toEqual([{ id: "c" }])
    expect(next.next.remoteCount).toBe(5)
  })

  it("recreates the complete thread after a missing-thread response", async () => {
    const recovered = await recreateMissingThread(
      { ok: false, status: 400, data: { detail: "Thread not found: amp-x" } },
      async () => ({ ok: true, status: 201, data: { thread_id: "amp-x" } }),
    )
    expect(recovered.recreated).toBe(true)
    expect(recovered.response.ok).toBe(true)
  })

  it("leaves a successful or unrelated failure unchanged", async () => {
    const ok = await recreateMissingThread(
      { ok: true, status: 200, data: {} },
      async () => ({ ok: false, status: 500, data: {} }),
    )
    expect(ok.recreated).toBe(false)
    expect(ok.response.ok).toBe(true)

    const other = await recreateMissingThread(
      { ok: false, status: 500, data: { detail: "boom" } },
      async () => ({ ok: true, status: 201, data: {} }),
    )
    expect(other.recreated).toBe(false)
    expect(other.response.status).toBe(500)
  })

  it("fingerprints messages as stable JSON", () => {
    expect(stableMessageFingerprint({ id: "a" })).toBe(JSON.stringify({ id: "a" }))
  })
})
