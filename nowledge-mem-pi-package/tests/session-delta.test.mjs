import assert from "node:assert/strict";
import test from "node:test";

import {
	isCheckpointedAppendAck,
	selectAcknowledgedDelta,
	sessionSyncLaneKey,
} from "../extensions/session-delta.ts";

const id = (message) => message.id;

test("selects only the unacknowledged suffix", () => {
	const messages = [{ id: "a" }, { id: "b" }, { id: "c" }];
	const cursor = selectAcknowledgedDelta(messages.slice(0, 2), undefined, id).next;
	const delta = selectAcknowledgedDelta(messages, cursor, id);
	assert.deepEqual(delta.messages, [{ id: "c" }]);
	assert.equal(delta.next.count, 3);
	assert.equal(delta.next.lastExternalId, "c");
	assert.equal(delta.reset, false);
});

test("resets when a compacted branch no longer contains the anchor", () => {
	const messages = [{ id: "new-a" }, { id: "new-b" }];
	const cursor = selectAcknowledgedDelta([{ id: "old-a" }], undefined, id).next;
	const delta = selectAcknowledgedDelta(messages, cursor, id);
	assert.deepEqual(delta.messages, messages);
	assert.equal(delta.start, 0);
	assert.equal(delta.reset, true);
});

test("returns no work for an exact replay", () => {
	const messages = [{ id: "a" }, { id: "b" }];
	const cursor = selectAcknowledgedDelta(messages, undefined, id).next;
	const delta = selectAcknowledgedDelta(messages, cursor, id);
	assert.deepEqual(delta.messages, []);
	assert.deepEqual(delta.next, cursor);
});

test("resets when an earlier message changes but the final anchor is unchanged", () => {
	const original = [{ id: "a", content: "old" }, { id: "b", content: "same" }];
	const cursor = selectAcknowledgedDelta(original, undefined, id).next;
	const changed = [{ id: "a", content: "new" }, { id: "b", content: "same" }];
	const delta = selectAcknowledgedDelta(changed, cursor, id);
	assert.equal(delta.reset, true);
	assert.deepEqual(delta.messages, changed);
});

test("isolates cursor state by complete destination lane", () => {
	const first = sessionSyncLaneKey("thread", "https://mem", "key", "space-a", "agent", "host");
	const second = sessionSyncLaneKey("thread", "https://mem", "key", "space-b", "agent", "host");
	const messages = [{ id: "a" }, { id: "b" }];
	const states = new Map();
	states.set(first, selectAcknowledgedDelta(messages, undefined, id).next);
	assert.notEqual(first, second);
	assert.equal(
		first,
		sessionSyncLaneKey("thread", "https://mem", "key", "space-a", "agent", "host"),
	);
	const secondDestination = selectAcknowledgedDelta(messages, states.get(second), id);
	assert.deepEqual(secondDestination.messages, messages);
});

test("requires an explicit checkpoint acknowledgement", () => {
	assert.equal(isCheckpointedAppendAck({ append_mode: "checkpointed" }), true);
	assert.equal(isCheckpointedAppendAck({ success: true }), false);
});
