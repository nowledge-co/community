import assert from "node:assert/strict";
import test from "node:test";

import { NowledgeMemClient } from "../main.js";

const logger = { info() {}, warn() {}, debug() {}, error() {} };

function jsonResponse(status, data) {
	return {
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => "application/json" },
		json: async () => data,
		text: async () => JSON.stringify(data),
	};
}

test("appendThread sends checkpoint fields and requires a checkpointed ack", async () => {
	const bodies = [];
	const previous = globalThis.fetch;
	globalThis.fetch = async (_url, init) => {
		bodies.push(JSON.parse(init.body));
		return jsonResponse(200, {
			success: true,
			append_mode: "checkpointed",
			messages_added: 1,
			total_messages: 3,
		});
	};
	try {
		const client = new NowledgeMemClient(logger, { threadSyncTimeoutMs: 5_000 });
		const result = await client.appendThread(
			"alma-x",
			[{ role: "user", content: "next" }],
			{ idempotencyKey: "alma-thread:alma-x:2-3:abc", expectedMessageCount: 2 },
		);
		assert.equal(result.total_messages, 3);
		assert.equal(bodies[0].expected_message_count, 2);
		assert.equal(bodies[0].idempotency_key, "alma-thread:alma-x:2-3:abc");
		assert.equal(bodies[0].deduplicate, true);
	} finally {
		globalThis.fetch = previous;
	}
});

test("appendThread does not treat a success-only body as an ack", async () => {
	const previous = globalThis.fetch;
	globalThis.fetch = async () => jsonResponse(200, { success: true });
	try {
		const client = new NowledgeMemClient(logger, {});
		await assert.rejects(
			() => client.appendThread("alma-x", [{ role: "user", content: "hi" }]),
			/explicit persistence acknowledgement/,
		);
	} finally {
		globalThis.fetch = previous;
	}
});

test("appendThread rejects a non-checkpointed ack when a checkpoint was required", async () => {
	const previous = globalThis.fetch;
	globalThis.fetch = async () =>
		jsonResponse(200, { success: true, messages_added: 1, total_messages: 2 });
	try {
		const client = new NowledgeMemClient(logger, {});
		await assert.rejects(
			() =>
				client.appendThread("alma-x", [{ role: "user", content: "hi" }], {
					expectedMessageCount: 1,
				}),
			/not acknowledged as checkpointed/,
		);
	} finally {
		globalThis.fetch = previous;
	}
});

test("create and append use the configured thread-sync timeout, not the 15s default", async () => {
	const timeouts = [];
	const previous = globalThis.fetch;
	globalThis.fetch = async (_url, init) => {
		timeouts.push(init.signal);
		return jsonResponse(200, {
			success: true,
			append_mode: "checkpointed",
			messages_added: 1,
			total_messages: 1,
			thread: { thread_id: "alma-x", message_count: 1 },
			messages: [{ role: "user", content: "hi" }],
		});
	};
	try {
		const client = new NowledgeMemClient(logger, { threadSyncTimeoutMs: 90_000 });
		assert.equal(client._threadSyncTimeoutMs, 90_000);
		await client.createThread("t", "", [{ role: "user", content: "hi" }], "alma", "alma-x");
		await client.appendThread("alma-x", [{ role: "assistant", content: "ok" }], {
			expectedMessageCount: 1,
		});
		assert.equal(timeouts.length, 2);
	} finally {
		globalThis.fetch = previous;
	}
});

test("isThreadNotFoundError treats HTTP 400 Thread not found as recreate", () => {
	const client = new NowledgeMemClient(logger, {});
	const err = new Error("HTTP 400: Thread not found: alma-x");
	err.status = 400;
	assert.equal(client.isThreadNotFoundError(err), true);
	const coded = new Error("missing");
	coded.code = "thread_not_found";
	assert.equal(client.isThreadNotFoundError(coded), true);
	const other = new Error("HTTP 500: boom");
	other.status = 500;
	assert.equal(client.isThreadNotFoundError(other), false);
});
