import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
	_resetSyncCursors,
	appendOrCreateThread,
	buildThreadTitle,
	normalizeRoleMessage,
} from "../src/hooks/capture.js";
import { NowledgeMemClient } from "../src/client.js";

const logger = {
	info() {},
	warn() {},
	debug() {},
};

test("thread-not-found detection does not recreate after an unrelated server failure", () => {
	const client = new NowledgeMemClient(logger, {});
	const missing = new Error("Thread not found: oc-x");
	missing.status = 400;
	assert.equal(client.isThreadNotFoundError(missing), true);

	const upstream = new Error("Upstream failed: thread not found");
	upstream.status = 500;
	assert.equal(client.isThreadNotFoundError(upstream), false);
});

test("createThread requires and sends a normalized thread id", async () => {
	const client = new NowledgeMemClient(logger, {});
	const requests = [];
	client.apiJson = async (method, path, body) => {
		requests.push({ method, path, body });
		return { thread_id: "oc-target", message_count: 1 };
	};
	const messages = [{ role: "user", content: "hello" }];

	await assert.rejects(
		client.createThread({ threadId: " ", title: "title", messages }),
		/createThread requires threadId/,
	);
	assert.equal(requests.length, 0);

	const ack = await client.createThread({
		threadId: "  oc-target  ",
		title: "title",
		messages,
	});
	assert.deepEqual(ack, { threadId: "oc-target", totalMessages: 1 });
	assert.deepEqual(requests, [
		{
			method: "POST",
			path: "/threads",
			body: {
				thread_id: "oc-target",
				title: "title",
				source: "openclaw",
				messages,
			},
		},
	]);
});

function message(role, content, extra = {}) {
	return {
		role,
		content,
		...extra,
	};
}

function fallbackExternalId(seed) {
	return `oc-msg:${createHash("sha1").update(seed).digest("hex")}`;
}

test("normalizes OpenClaw epoch-millisecond timestamps for the Mem API", () => {
	const normalized = normalizeRoleMessage(
		message("user", "remember this", { timestamp: 1_751_881_234_567 }),
	);

	assert.equal(normalized.timestamp, "2025-07-07T09:40:34.567Z");
	assert.equal(
		normalizeRoleMessage(
			message("assistant", "already textual", {
				timestamp: "2025-07-07T14:20:34.567Z",
			}),
		).timestamp,
		"2025-07-07T14:20:34.567Z",
	);
	assert.equal(
		normalizeRoleMessage(
			message("assistant", "invalid timestamp", { timestamp: Number.NaN }),
		).timestamp,
		undefined,
	);
});

test("uses the first user message as a readable thread title", () => {
	assert.equal(
		buildThreadTitle(
			{ sessionKey: "agent:main:dashboard:b17192bf-149b-41ec" },
			[
				{ role: "user", fullContent: "  帮我检查一下 OpenClaw 的线程同步  \n" },
				{ role: "assistant", fullContent: "好的" },
			],
		),
		"帮我检查一下 OpenClaw 的线程同步",
	);
	assert.equal(
		buildThreadTitle(
			{ sessionKey: "agent:main:openclaw-weixin:direct:user-id" },
			[{ role: "assistant", fullContent: "No user turn available" }],
		),
		"OpenClaw · WeChat",
	);
	assert.equal(
		buildThreadTitle({}, []),
		"OpenClaw conversation",
	);
});

class FakeThreadClient {
	constructor({ existingCount = null, existingExternalIds = [] } = {}) {
		this.existingCount = existingCount;
		this.existingExternalIds = new Set(existingExternalIds);
		this.appendCalls = [];
		this.createCalls = [];
	}

	async getThreadMessageCount() {
		return this.existingCount;
	}

	async appendThread(request) {
		this.appendCalls.push(request);
		if (this.failAppend) {
			const error = new Error(this.failAppend);
			if (this.failAppendCode) error.code = this.failAppendCode;
			throw error;
		}
		const messagesToAdd = request.deduplicate
			? request.messages.filter((message) => {
					const externalId = message?.metadata?.external_id;
					if (typeof externalId !== "string" || !externalId) return true;
					if (this.existingExternalIds.has(externalId)) return false;
					this.existingExternalIds.add(externalId);
					return true;
				})
			: request.messages;
		const messagesAdded = messagesToAdd.length;
		const totalMessages =
			typeof this.existingCount === "number"
				? this.existingCount + messagesAdded
				: messagesAdded;
		this.existingCount = totalMessages;
		return { messagesAdded, totalMessages };
	}

	async createThread(request) {
		this.createCalls.push(request);
		if (this.createAck !== undefined) return this.createAck;
		this.existingCount = request.messages.length;
		return {
			threadId: request.threadId,
			totalMessages: request.messages.length,
		};
	}

	isThreadNotFoundError(error) {
		return error?.code === "thread_not_found";
	}
}

test("auto capture appends latest OpenClaw Codex per-turn agent_end batches", async () => {
	const client = new FakeThreadClient({ existingCount: 6 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "continue", {
					__openclaw: { mirrorIdentity: "turn-2:prompt" },
				}),
				message("assistant", [{ type: "text", text: "done" }], {
					__openclaw: { mirrorIdentity: "turn-2:assistant" },
				}),
			],
			success: true,
		},
		ctx: {
			sessionId: "session-auto-delta",
			sessionKey: "agent:main:telegram:direct:auto-delta",
			runId: "run-2",
		},
		reason: "agent_end",
		messageMode: "auto",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.createCalls.length, 0);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.metadata.external_id),
		["oc:turn-2-prompt", "oc:turn-2-assistant"],
	);
});

test("auto capture sends textual timestamps to the thread append API", async () => {
	const client = new FakeThreadClient({ existingCount: 1 });
	await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "prompt", {
					__openclaw: { mirrorIdentity: "turn-2:prompt" },
				}),
				message("assistant", "captured", {
					timestamp: 1_751_881_234_567,
					__openclaw: { mirrorIdentity: "turn-2:assistant" },
				}),
			],
		},
		ctx: {
			sessionId: "session-timestamp",
			sessionKey: "agent:main:telegram:direct:timestamp",
			runId: "run-2",
		},
		reason: "agent_end",
		messageMode: "delta",
	});

	assert.equal(
		client.appendCalls[0].messages.find((msg) => msg.role === "assistant").timestamp,
		"2025-07-07T09:40:34.567Z",
	);
});

test("auto capture appends same-length Codex per-turn batches when messages have stable identities", async () => {
	const client = new FakeThreadClient({ existingCount: 2 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "repeat the next step", {
					__openclaw: { mirrorIdentity: "turn-2:prompt" },
				}),
				message("assistant", "next step", {
					__openclaw: { mirrorIdentity: "turn-2:assistant" },
				}),
			],
			success: true,
		},
		ctx: {
			sessionId: "session-auto-equal-delta",
			sessionKey: "agent:main:telegram:direct:auto-equal-delta",
			runId: "run-2",
		},
		reason: "agent_end",
		messageMode: "auto",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.metadata.external_id),
		["oc:turn-2-prompt", "oc:turn-2-assistant"],
	);
});

test("auto capture appends all stable per-turn Codex messages even when the batch is longer than the synced prefix", async () => {
	const client = new FakeThreadClient({ existingCount: 2 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "run tools", {
					__openclaw: { mirrorIdentity: "turn-2:prompt" },
				}),
				message("assistant", "reasoning", {
					__openclaw: { mirrorIdentity: "turn-2:reasoning" },
				}),
				message("assistant", "tool result", {
					__openclaw: { mirrorIdentity: "turn-2:tool:call-1:result" },
				}),
				message("assistant", "done", {
					__openclaw: { mirrorIdentity: "turn-2:assistant" },
				}),
			],
			success: true,
		},
		ctx: {
			sessionId: "session-auto-longer-delta",
			sessionKey: "agent:main:telegram:direct:auto-longer-delta",
			runId: "run-2",
		},
		reason: "agent_end",
		messageMode: "auto",
	});

	assert.equal(result.messagesAdded, 4);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.metadata.external_id),
		[
			"oc:turn-2-prompt",
			"oc:turn-2-reasoning",
			"oc:turn-2-tool-call-1-result",
			"oc:turn-2-assistant",
		],
	);
});

test("auto capture remains idempotent when a stable full transcript is emitted", async () => {
	const client = new FakeThreadClient({
		existingCount: 2,
		existingExternalIds: ["oc:turn-1-prompt", "oc:turn-1-assistant"],
	});
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first", {
					__openclaw: { mirrorIdentity: "turn-1:prompt" },
				}),
				message("assistant", "second", {
					__openclaw: { mirrorIdentity: "turn-1:assistant" },
				}),
				message("user", "third", {
					__openclaw: { mirrorIdentity: "turn-2:prompt" },
				}),
				message("assistant", "fourth", {
					__openclaw: { mirrorIdentity: "turn-2:assistant" },
				}),
			],
		},
		ctx: {
			sessionId: "session-auto-full-snapshot",
			sessionKey: "agent:main:telegram:direct:auto-full-snapshot",
			runId: "run-2",
		},
		reason: "agent_end",
		messageMode: "auto",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.equal(client.appendCalls[0].messages.length, 4);
});

test("snapshot capture does not trust a remote count as a local prefix", async () => {
	const client = new FakeThreadClient({ existingCount: 6 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "summarized prompt"),
				message("assistant", "summarized answer"),
			],
		},
		ctx: {
			sessionId: "session-compacted",
			sessionKey: "agent:main:telegram:direct:compacted",
		},
		reason: "after_compaction",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.content),
		["summarized prompt", "summarized answer"],
	);
	assert.equal(client.appendCalls[0].expectedMessageCount, undefined);
	assert.equal(client.createCalls.length, 0);
});

test("auto capture replays a short snapshot batch without stable identities", async () => {
	const client = new FakeThreadClient({ existingCount: 6 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "short prompt without host identity"),
				message("assistant", "short answer without host identity"),
			],
		},
		ctx: {
			sessionId: "session-auto-short-unknown",
			sessionKey: "agent:main:telegram:direct:auto-short-unknown",
			runId: "run-2",
		},
		reason: "agent_end",
		messageMode: "auto",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.content),
		[
			"short prompt without host identity",
			"short answer without host identity",
		],
	);
	assert.equal(client.appendCalls[0].expectedMessageCount, undefined);
	assert.equal(client.createCalls.length, 0);
});

test("snapshot capture replays the local transcript until its prefix is acknowledged", async () => {
	const client = new FakeThreadClient({ existingCount: 2 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first"),
				message("assistant", "second"),
				message("user", "third"),
				message("assistant", "fourth"),
			],
		},
		ctx: {
			sessionId: "session-snapshot",
			sessionKey: "agent:main:telegram:direct:snapshot",
		},
		reason: "agent_end",
	});

	assert.equal(result.messagesAdded, 4);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.content),
		["first", "second", "third", "fourth"],
	);
	assert.equal(client.appendCalls[0].expectedMessageCount, undefined);
});

test("snapshot fallback external IDs preserve the legacy seed shape", async () => {
	const sessionKey = "agent:main:telegram:direct:snapshot-fallback";
	const client = new FakeThreadClient({ existingCount: 0 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "legacy fallback"),
				message("assistant", "legacy reply"),
			],
		},
		ctx: {
			sessionId: "session-snapshot-fallback",
			sessionKey,
			runId: "run-ignored-in-snapshot",
		},
		reason: "after_turn",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.equal(
		client.appendCalls[0].messages[0].metadata.external_id,
		fallbackExternalId(
			`${result.threadId}|${sessionKey}|0|user|legacy fallback`,
		),
	);
});

test("delta fallback external IDs include run id when available", async () => {
	const sessionKey = "agent:main:telegram:direct:delta-fallback";
	const client = new FakeThreadClient({ existingCount: 0 });
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("assistant", "delta fallback"),
				message("user", "follow-up prompt"),
			],
		},
		ctx: {
			sessionId: "session-delta-fallback",
			sessionKey,
			runId: "run-42",
		},
		reason: "agent_end",
		messageMode: "delta",
	});

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.equal(
		client.appendCalls[0].messages[0].metadata.external_id,
		fallbackExternalId(
			`${result.threadId}|${sessionKey}|run:run-42|0|assistant|delta fallback`,
		),
	);
});

test("OpenClaw mirror identity wins over transcript idempotency key for stable dedupe", () => {
	const normalized = normalizeRoleMessage({
		role: "user",
		content: "hello",
		idempotencyKey: "codex-app-server:thread-a:turn-1:prompt",
		__openclaw: { mirrorIdentity: "turn-1:prompt" },
	});

	assert.equal(normalized.externalHint, "turn-1:prompt");
});


test("snapshot capture sends a content-bound checkpoint contract after the first ack", async () => {
	_resetSyncCursors();
	const client = new FakeThreadClient({ existingCount: 0 });
	const ctx = {
		sessionId: "session-checkpoint",
		sessionKey: "agent:main:telegram:direct:checkpoint",
	};
	await appendOrCreateThread({
		client,
		logger,
		event: { messages: [message("user", "first"), message("assistant", "second")] },
		ctx,
		reason: "agent_end",
	});
	const second = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first"),
				message("assistant", "second"),
				message("user", "third"),
				message("assistant", "fourth"),
			],
		},
		ctx,
		reason: "agent_end",
	});
	assert.equal(second.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 2);
	assert.equal(typeof client.appendCalls[1].idempotencyKey, "string");
	assert.match(client.appendCalls[1].idempotencyKey, /^oc:agent_end:/);
	assert.equal(client.appendCalls[1].expectedMessageCount, 2);
});

test("snapshot capture resets a same-length prefix replacement to a full replay", async () => {
	_resetSyncCursors();
	const client = new FakeThreadClient({ existingCount: 0 });
	const ctx = {
		sessionId: "session-same-length",
		sessionKey: "agent:main:telegram:direct:same-length",
	};
	await appendOrCreateThread({
		client,
		logger,
		event: { messages: [message("user", "old prompt"), message("assistant", "old answer")] },
		ctx,
		reason: "agent_end",
	});
	const replaced = await appendOrCreateThread({
		client,
		logger,
		event: { messages: [message("user", "new prompt"), message("assistant", "new answer")] },
		ctx,
		reason: "agent_end",
	});
	assert.equal(replaced.messagesAdded, 2);
	assert.deepEqual(
		client.appendCalls[1].messages.map((msg) => msg.content),
		["new prompt", "new answer"],
	);
	assert.equal(client.appendCalls[1].expectedMessageCount, undefined);
});

test("destination lanes isolate cursors by api url, key, and space", async () => {
	_resetSyncCursors();
	class LaneClient extends FakeThreadClient {
		constructor(lane, existingCount) {
			super({ existingCount });
			this.lane = lane;
		}
		cursorKey(threadId) {
			return `${this.lane}\0${threadId}`;
		}
	}
	const first = new LaneClient("https://mem\0key-a\0space-a", 0);
	const second = new LaneClient("https://mem\0key-a\0space-b", 0);
	const ctx = {
		sessionId: "session-lane",
		sessionKey: "agent:main:telegram:direct:lane",
	};
	const event = { messages: [message("user", "hello"), message("assistant", "hi")] };
	await appendOrCreateThread({ client: first, logger, event, ctx, reason: "agent_end" });
	await appendOrCreateThread({ client: second, logger, event, ctx, reason: "agent_end" });
	assert.equal(first.appendCalls.length, 1);
	assert.equal(second.appendCalls.length, 1);
});

test("failed appends do not advance the local cursor", async () => {
	_resetSyncCursors();
	const client = new FakeThreadClient({ existingCount: 0 });
	const ctx = {
		sessionId: "session-no-ack",
		sessionKey: "agent:main:telegram:direct:no-ack",
	};
	await appendOrCreateThread({
		client,
		logger,
		event: { messages: [message("user", "first"), message("assistant", "second")] },
		ctx,
		reason: "agent_end",
	});
	client.failAppend = "Thread append was not acknowledged as checkpointed";
	const failed = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first"),
				message("assistant", "second"),
				message("user", "third"),
				message("assistant", "fourth"),
			],
		},
		ctx,
		reason: "agent_end",
	});
	assert.equal(failed, null);
	client.failAppend = "";
	const retried = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first"),
				message("assistant", "second"),
				message("user", "third"),
				message("assistant", "fourth"),
			],
		},
		ctx,
		reason: "agent_end",
	});
	assert.equal(retried.messagesAdded, 2);
	assert.deepEqual(
		client.appendCalls.at(-1).messages.map((msg) => msg.content),
		["third", "fourth"],
	);
});

test("skips persist until a user+assistant pair exists", async () => {
	const client = new FakeThreadClient();
	const result = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [message("user", "only a prompt so far")],
			success: true,
		},
		ctx: {
			sessionId: "session-user-only",
			sessionKey: "agent:main:telegram:direct:user-only",
		},
		reason: "before_reset",
	});
	assert.equal(result, undefined);
	assert.equal(client.appendCalls.length, 0);
	assert.equal(client.createCalls.length, 0);
});

test("snapshot capture leaves a trailing user turn for the next assistant", async () => {
	_resetSyncCursors();
	const client = new FakeThreadClient({ existingCount: 0 });
	const ctx = {
		sessionId: "session-trailing-user",
		sessionKey: "agent:main:telegram:direct:trailing-user",
	};
	const first = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first"),
				message("assistant", "answer"),
				message("user", "wait for me"),
			],
		},
		ctx,
		reason: "before_reset",
	});
	assert.equal(first.messagesAdded, 2);
	assert.deepEqual(client.appendCalls[0].messages.map((msg) => msg.content), ["first", "answer"]);

	const second = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first"),
				message("assistant", "answer"),
				message("user", "wait for me"),
				message("assistant", "now complete"),
			],
		},
		ctx,
		reason: "agent_end",
	});
	assert.equal(second.messagesAdded, 2);
	assert.deepEqual(client.appendCalls[1].messages.map((msg) => msg.content), [
		"wait for me",
		"now complete",
	]);
});

test("create without an explicit persistence ack does not advance the cursor", async () => {
	_resetSyncCursors();
	const client = new FakeThreadClient();
	client.failAppend = "thread not found";
	client.failAppendCode = "thread_not_found";
	client.createAck = null;
	const ctx = {
		sessionId: "session-create-no-ack",
		sessionKey: "agent:main:telegram:direct:create-no-ack",
	};
	const event = { messages: [message("user", "hello"), message("assistant", "hi")] };
	const failed = await appendOrCreateThread({ client, logger, event, ctx, reason: "agent_end" });
	assert.equal(failed, null);
	client.failAppend = "";
	const retried = await appendOrCreateThread({ client, logger, event, ctx, reason: "agent_end" });
	assert.equal(retried.messagesAdded, 2);
	assert.equal(client.appendCalls.at(-1).messages.length, 2);
});

test("capture continues when remote message count lookup fails", async () => {
	_resetSyncCursors();
	const warnings = [];
	const warnLogger = {
		...logger,
		warn(msg) {
			warnings.push(msg);
		},
	};
	class FailingCountClient extends FakeThreadClient {
		async getThreadMessageCount() {
			throw new Error("backend unavailable");
		}
	}
	const client = new FailingCountClient();
	const result = await appendOrCreateThread({
		client,
		logger: warnLogger,
		event: {
			messages: [message("user", "hello"), message("assistant", "hi")],
		},
		ctx: {
			sessionId: "session-count-fail",
			sessionKey: "agent:main:telegram:direct:count-fail",
		},
		reason: "agent_end",
	});
	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.match(warnings.join("\n"), /remote message count failed/);
});

test("delta capture cursor lets a later snapshot append only the suffix", async () => {
	_resetSyncCursors();
	const client = new FakeThreadClient({ existingCount: 0 });
	const ctx = {
		sessionId: "session-delta-then-snapshot",
		sessionKey: "agent:main:telegram:direct:delta-then-snapshot",
	};
	await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first", {
					__openclaw: { mirrorIdentity: "turn-1:prompt" },
				}),
				message("assistant", "second", {
					__openclaw: { mirrorIdentity: "turn-1:assistant" },
				}),
			],
		},
		ctx,
		reason: "agent_end",
		messageMode: "delta",
	});
	const later = await appendOrCreateThread({
		client,
		logger,
		event: {
			messages: [
				message("user", "first", {
					__openclaw: { mirrorIdentity: "turn-1:prompt" },
				}),
				message("assistant", "second", {
					__openclaw: { mirrorIdentity: "turn-1:assistant" },
				}),
				message("user", "third", {
					__openclaw: { mirrorIdentity: "turn-2:prompt" },
				}),
				message("assistant", "fourth", {
					__openclaw: { mirrorIdentity: "turn-2:assistant" },
				}),
			],
		},
		ctx,
		reason: "agent_end",
		messageMode: "snapshot",
	});
	assert.equal(later.messagesAdded, 2);
	assert.deepEqual(
		client.appendCalls.at(-1).messages.map((msg) => msg.content),
		["third", "fourth"],
	);
	assert.equal(client.appendCalls.at(-1).expectedMessageCount, 2);
});
