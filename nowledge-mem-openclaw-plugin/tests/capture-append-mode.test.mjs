import assert from "node:assert/strict";
import test from "node:test";

import {
	appendOrCreateThread,
	normalizeRoleMessage,
} from "../src/hooks/capture.js";

const logger = {
	info() {},
	warn() {},
	debug() {},
};

function message(role, content, extra = {}) {
	return {
		role,
		content,
		...extra,
	};
}

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
		this.existingCount = request.messages.length;
		return request.threadId;
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

test("snapshot capture still treats a shorter transcript as compaction shrink", async () => {
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

	assert.equal(result.messagesAdded, 0);
	assert.equal(client.appendCalls.length, 0);
	assert.equal(client.createCalls.length, 0);
});

test("auto capture requires stable identities before treating a short batch as delta", async () => {
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

	assert.equal(result.messagesAdded, 0);
	assert.equal(client.appendCalls.length, 0);
	assert.equal(client.createCalls.length, 0);
});

test("snapshot capture appends only the tail of full-transcript hook payloads", async () => {
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

	assert.equal(result.messagesAdded, 2);
	assert.equal(client.appendCalls.length, 1);
	assert.deepEqual(
		client.appendCalls[0].messages.map((msg) => msg.content),
		["third", "fourth"],
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
