import assert from "node:assert/strict";
import test from "node:test";
import {
  appendAcknowledgedRemoteCount,
  createAcknowledgedRemoteCount,
  isCheckpointedAppendAck,
  isThreadAppendAck,
  isThreadCreateAck,
} from "../src/acknowledgement.ts";

test("malformed or ambiguous append responses cannot acknowledge persistence", () => {
  for (const data of [undefined, null, [], true, "ok", {}, { success: true },
    { success: false, messages_added: 1, total_messages: 2 }]) {
    assert.equal(isThreadAppendAck(data), false);
    assert.equal(appendAcknowledgedRemoteCount(data), undefined);
    assert.equal(isCheckpointedAppendAck(data), false);
  }
  for (const count of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "2"]) {
    for (const field of ["messages_added", "total_messages"]) {
      const data = { success: true, messages_added: 1, total_messages: 2, append_mode: "checkpointed", [field]: count };
      assert.equal(isThreadAppendAck(data), false);
      assert.equal(isCheckpointedAppendAck(data), false);
      assert.equal(appendAcknowledgedRemoteCount(data), undefined);
    }
  }
});

test("idempotent retries may acknowledge zero new messages with a larger remote count", () => {
  const data = { success: true, messages_added: 0, total_messages: 20, append_mode: "checkpointed" };
  assert.equal(appendAcknowledgedRemoteCount(data), 20);
  assert.equal(isCheckpointedAppendAck(data), true);
  assert.equal(isCheckpointedAppendAck({ ...data, append_mode: "deduplicated" }), false);
  assert.equal(isThreadAppendAck({ ...data, append_mode: "deduplicated" }), true);
});

test("create responses require identity, with message-array compatibility only for an absent count", () => {
  assert.equal(createAcknowledgedRemoteCount({ thread: { thread_id: "Host_MixedCase", message_count: 0 } }, "Host_MixedCase"), 0);
  assert.equal(createAcknowledgedRemoteCount({ thread: { thread_id: "Host_MixedCase" }, messages: [{}, {}] }, "Host_MixedCase"), 2);
  for (const data of [null, {}, { thread: {} }, { thread: { thread_id: "host_mixedcase", message_count: 2 } }]) {
    assert.equal(isThreadCreateAck(data, "Host_MixedCase"), false);
    assert.equal(createAcknowledgedRemoteCount(data, "Host_MixedCase"), undefined);
  }
  for (const count of [-1, 0.5, null, "2", Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(createAcknowledgedRemoteCount({ thread: { thread_id: "Host_MixedCase", message_count: count }, messages: [{}] }, "Host_MixedCase"), undefined);
  }
});
