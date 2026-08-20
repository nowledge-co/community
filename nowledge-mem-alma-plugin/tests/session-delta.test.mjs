import assert from "node:assert/strict";
import test from "node:test";

import {
	beginInFlightFlush,
	contentBoundIdempotencyKey,
	finishInFlightFlush,
	hasUserAndAssistant,
	isCheckpointConflictResponse,
	isCheckpointedAppendAck,
	isThreadAppendAck,
	isThreadNotFoundResponse,
	planAutomaticFlush,
	selectAcknowledgedDelta,
	sessionSyncLaneKey,
} from "../session-delta.js";
import { resolveThreadSyncTimeoutMs } from "../thread-sync-timeout.js";

const id = (message) => message.id;

test("sessionSyncLaneKey isolates api url, key, and space", () => {
	const first = sessionSyncLaneKey("thread", "https://mem", "key", "space-a");
	const second = sessionSyncLaneKey("thread", "https://mem", "key", "space-b");
	assert.notEqual(first, second);
	assert.notEqual(
		sessionSyncLaneKey("thread", "https://mem", "key-a", "space"),
		sessionSyncLaneKey("thread", "https://mem", "key-b", "space"),
	);
	assert.equal(sessionSyncLaneKey("thread", "https://mem", "key", "space-a"), first);
});

test("selectAcknowledgedDelta appends only the unacknowledged suffix", () => {
	const first = [{ id: "a" }, { id: "b" }];
	const cursor = selectAcknowledgedDelta(first, undefined, id).next;
	const delta = selectAcknowledgedDelta([...first, { id: "c" }], cursor, id);
	assert.deepEqual(delta.messages, [{ id: "c" }]);
	assert.equal(delta.reset, false);
});

test("selectAcknowledgedDelta resets same-length prefix replacements", () => {
	const original = [
		{ id: "a", content: "old" },
		{ id: "b", content: "same" },
	];
	const cursor = selectAcknowledgedDelta(original, undefined, id).next;
	const changed = [
		{ id: "a", content: "new" },
		{ id: "b", content: "same" },
	];
	const delta = selectAcknowledgedDelta(changed, cursor, id);
	assert.equal(delta.reset, true);
	assert.deepEqual(delta.messages, changed);
});

test("count-only cursors without fingerprints still slice the tail", () => {
	const messages = [{ id: "a" }, { id: "b" }, { id: "c" }];
	const delta = selectAcknowledgedDelta(messages, { count: 2, remoteCount: 2 }, id);
	assert.deepEqual(delta.messages, [{ id: "c" }]);
	assert.equal(delta.reset, false);
});

test("acknowledgement helpers require explicit checkpointed acks", () => {
	assert.equal(
		isCheckpointedAppendAck({
			success: true,
			append_mode: "checkpointed",
			messages_added: 1,
			total_messages: 3,
		}),
		true,
	);
	assert.equal(isThreadAppendAck({ success: true, messages_added: 1, total_messages: 3 }), true);
	assert.equal(isThreadAppendAck({ success: true, messages_added: -1, total_messages: 3 }), false);
	assert.equal(isThreadAppendAck({ success: true, messages_added: 1, total_messages: -1 }), false);
	assert.equal(isCheckpointedAppendAck({ success: true, messages_added: 1, total_messages: 3 }), false);
	assert.equal(isCheckpointConflictResponse({ error_code: "checkpoint_conflict" }), true);
	assert.equal(isThreadNotFoundResponse(400, { detail: "Thread not found: alma-x" }), true);
	assert.equal(isThreadNotFoundResponse(400, { error_code: "thread_not_found" }), true);
	assert.equal(isThreadNotFoundResponse(500, { detail: "other" }), false);
	assert.equal(isThreadNotFoundResponse(500, { detail: "upstream thread not found" }), false);
	assert.match(
		contentBoundIdempotencyKey("alma-thread", "t", 2, 4, "abc"),
		/^alma-thread:t:2-4:abc$/,
	);
});

test("planAutomaticFlush omits expected_message_count until a trusted fingerprint exists", () => {
	const first = [
		{ role: "user", content: "hi" },
		{ role: "assistant", content: "hello" },
	];
	const initial = planAutomaticFlush({ messages: first, cursor: null, threadId: "alma-x" });
	assert.equal(initial.expectedMessageCount, undefined);
	assert.equal(initial.delta.start, 0);
	assert.match(initial.idempotencyKey, /^alma-thread:alma-x:0-2:/);

	const trusted = planAutomaticFlush({
		messages: [...first, { role: "user", content: "next" }],
		cursor: { ...initial.delta.next, remoteCount: 2 },
		threadId: "alma-x",
	});
	assert.equal(trusted.expectedMessageCount, 2);
	assert.deepEqual(trusted.delta.messages, []);

	const completed = planAutomaticFlush({
		messages: [
			...first,
			{ role: "user", content: "next" },
			{ role: "assistant", content: "done" },
		],
		cursor: { ...initial.delta.next, remoteCount: 2 },
		threadId: "alma-x",
	});
	assert.deepEqual(completed.delta.messages, [
		{ role: "user", content: "next" },
		{ role: "assistant", content: "done" },
	]);
});

test("resolveThreadSyncTimeoutMs honors 120s default and 1s-30min bounds", () => {
	assert.equal(resolveThreadSyncTimeoutMs(undefined), 120_000);
	assert.equal(resolveThreadSyncTimeoutMs("5000"), 5_000);
	assert.equal(resolveThreadSyncTimeoutMs("250"), 1_000);
	assert.equal(resolveThreadSyncTimeoutMs("9999999"), 30 * 60_000);
	assert.equal(resolveThreadSyncTimeoutMs("abc"), 120_000);
});

test("hasUserAndAssistant requires both roles, not just two messages", () => {
	assert.equal(hasUserAndAssistant([{ role: "user", content: "a" }]), false);
	assert.equal(
		hasUserAndAssistant([
			{ role: "user", content: "a" },
			{ role: "user", content: "b" },
		]),
		false,
	);
	assert.equal(
		hasUserAndAssistant([
			{ role: "user", content: "a" },
			{ role: "assistant", content: "b" },
		]),
		true,
	);
});

test("in-flight flush coalesces a second request instead of dropping it", () => {
	const state = { flushing: false, pending: false };
	assert.equal(beginInFlightFlush(state), "run");
	assert.equal(state.flushing, true);
	assert.equal(beginInFlightFlush(state), "wait");
	assert.equal(state.pending, true);
	assert.equal(finishInFlightFlush(state), "rerun");
	assert.equal(state.flushing, false);
	assert.equal(state.pending, false);
	assert.equal(beginInFlightFlush(state), "run");
	assert.equal(finishInFlightFlush(state), "done");
});
