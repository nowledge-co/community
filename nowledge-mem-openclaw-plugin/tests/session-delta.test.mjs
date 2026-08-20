import assert from "node:assert/strict";
import test from "node:test";

import {
	contentBoundIdempotencyKey,
	hasUserAndAssistant,
	isCheckpointConflictResponse,
	isCheckpointedAppendAck,
	isThreadAppendAck,
	prefixFingerprint,
	selectSnapshotDelta,
	sessionSyncLaneKey,
	stableMessageFingerprint,
	threadCreateAck,
} from "../src/session-delta.js";
import { resolveThreadSyncTimeoutMs } from "../src/thread-sync-timeout.js";

const id = (message) => message.id;

test("sessionSyncLaneKey isolates api url, key, and space", () => {
	const first = sessionSyncLaneKey("thread", "https://mem", "key", "space-a");
	const second = sessionSyncLaneKey("thread", "https://mem", "key", "space-b");
	assert.notEqual(first, second);
	assert.notEqual(
		sessionSyncLaneKey("thread", "https://mem", "key-a", "space"),
		sessionSyncLaneKey("thread", "https://mem", "key-b", "space"),
	);
	assert.equal(
		sessionSyncLaneKey("thread", "https://mem", "key", "space-a"),
		first,
	);
});

test("selectSnapshotDelta appends only the unacknowledged suffix", () => {
	const first = [{ id: "a" }, { id: "b" }];
	const cursor = selectSnapshotDelta(first, undefined, id).next;
	const delta = selectSnapshotDelta([...first, { id: "c" }], cursor, id);
	assert.deepEqual(delta.messages, [{ id: "c" }]);
	assert.equal(delta.reset, false);
});

test("selectSnapshotDelta resets same-length prefix replacements", () => {
	const original = [
		{ id: "a", content: "old" },
		{ id: "b", content: "same" },
	];
	const cursor = selectSnapshotDelta(original, undefined, id).next;
	const changed = [
		{ id: "a", content: "new" },
		{ id: "b", content: "same" },
	];
	const delta = selectSnapshotDelta(changed, cursor, id);
	assert.equal(delta.reset, true);
	assert.deepEqual(delta.messages, changed);
});

test("selectSnapshotDelta treats a shorter transcript as OpenClaw compaction", () => {
	const cursor = selectSnapshotDelta(
		[{ id: "a" }, { id: "b" }, { id: "c" }],
		undefined,
		id,
	).next;
	const delta = selectSnapshotDelta([{ id: "new-a" }, { id: "new-b" }], cursor, id);
	assert.equal(delta.compactionShrink, true);
	assert.deepEqual(delta.messages, []);
	assert.equal(delta.next.count, 2);
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
	assert.equal(isCheckpointedAppendAck({ success: true, messages_added: 1, total_messages: 3 }), false);
	assert.equal(isCheckpointConflictResponse({ error_code: "checkpoint_conflict" }), true);
	assert.match(
		contentBoundIdempotencyKey("oc:agent_end", "t", 2, 4, "abc"),
		/^oc:agent_end:t:2-4:abc$/,
	);
});

test("threadCreateAck requires the target id and an explicit non-negative count", () => {
	assert.deepEqual(threadCreateAck({ thread_id: "target", message_count: 2 }, "target"), {
		threadId: "target",
		totalMessages: 2,
	});
	assert.equal(threadCreateAck({ thread_id: "other", message_count: 2 }, "target"), null);
	assert.equal(threadCreateAck({ thread_id: "target" }, "target"), null);
	assert.equal(threadCreateAck({ thread_id: "target", message_count: -1 }, "target"), null);
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

test("prefixFingerprint hashes the length-prefixed prefix with the default fingerprint", () => {
	const messages = [
		{ role: "user", content: "a", metadata: { external_id: "a" } },
		{ role: "assistant", content: "b", metadata: { external_id: "b" } },
	];
	const hashed = prefixFingerprint(messages, messages.length);
	assert.match(hashed, /^[0-9a-f]{64}$/);
	assert.equal(
		hashed,
		prefixFingerprint(messages, messages.length, stableMessageFingerprint),
	);
	assert.notEqual(hashed, stableMessageFingerprint(messages[messages.length - 1]));
});

test("selectSnapshotDelta trusts a cursor hashed with the shared prefixFingerprint helper", () => {
	const first = [
		{ id: "a", role: "user", content: "a" },
		{ id: "b", role: "assistant", content: "b" },
	];
	const cursor = {
		count: first.length,
		remoteCount: first.length,
		lastExternalId: "b",
		prefixFingerprint: prefixFingerprint(first, first.length),
	};
	const later = [...first, { id: "c", role: "user", content: "c" }];
	const delta = selectSnapshotDelta(later, cursor, id);
	assert.equal(delta.reset, false);
	assert.deepEqual(delta.messages, [{ id: "c", role: "user", content: "c" }]);
});
