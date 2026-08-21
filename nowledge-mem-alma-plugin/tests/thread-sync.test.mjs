import assert from "node:assert/strict";
import test from "node:test";

import { activate, NowledgeMemClient } from "../main.js";

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
		assert.equal(bodies[0].append_mode, "checkpointed");
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

function captureFetchTimeouts(client) {
	const calls = [];
	const original = client._fetch.bind(client);
	client._fetch = async (method, path, options = {}) => {
		calls.push({ method, path, timeout: options.timeout });
		return original(method, path, options);
	};
	return calls;
}

test("manual createThread keeps the 15s request timeout", async () => {
	const previous = globalThis.fetch;
	globalThis.fetch = async () =>
		jsonResponse(200, {
			thread: { thread_id: "alma-x", message_count: 1 },
			messages: [{ role: "user", content: "hi" }],
		});
	try {
		const client = new NowledgeMemClient(logger, { threadSyncTimeoutMs: 90_000 });
		const calls = captureFetchTimeouts(client);
		await client.createThread("t", "", [{ role: "user", content: "hi" }], "alma", "alma-x");
		assert.equal(calls.length, 1);
		assert.equal(calls[0].path, "/threads");
		assert.equal(calls[0].timeout, undefined);
	} finally {
		globalThis.fetch = previous;
	}
});

test("automatic createThread path can pass the configured sync timeout", async () => {
	const previous = globalThis.fetch;
	globalThis.fetch = async () =>
		jsonResponse(200, {
			thread: { thread_id: "alma-x", message_count: 1 },
			messages: [{ role: "user", content: "hi" }],
		});
	try {
		const client = new NowledgeMemClient(logger, { threadSyncTimeoutMs: 90_000 });
		const calls = captureFetchTimeouts(client);
		await client.createThread(
			"t",
			"",
			[{ role: "user", content: "hi" }],
			"alma",
			"alma-x",
			{ timeout: client._threadSyncTimeoutMs },
		);
		assert.equal(calls[0].timeout, 90_000);
	} finally {
		globalThis.fetch = previous;
	}
});

test("appendThread still uses the configured thread-sync timeout", async () => {
	const previous = globalThis.fetch;
	globalThis.fetch = async () =>
		jsonResponse(200, {
			success: true,
			append_mode: "checkpointed",
			messages_added: 1,
			total_messages: 2,
		});
	try {
		const client = new NowledgeMemClient(logger, { threadSyncTimeoutMs: 90_000 });
		const calls = captureFetchTimeouts(client);
		await client.appendThread("alma-x", [{ role: "assistant", content: "ok" }], {
			expectedMessageCount: 1,
		});
		assert.equal(calls[0].timeout, 90_000);
	} finally {
		globalThis.fetch = previous;
	}
});

test("createThread requires a thread identity and a non-negative total message count", async () => {
	const previous = globalThis.fetch;
	try {
		const client = new NowledgeMemClient(logger, {});
		globalThis.fetch = async () => jsonResponse(200, {});
		await assert.rejects(
			() => client.createThread("t", "hi", [], "alma", "alma-x"),
			/thread identity/,
		);
		globalThis.fetch = async () =>
			jsonResponse(200, { thread: { thread_id: "alma-x" }, messages: [{ role: "user", content: "hi" }] });
		await assert.rejects(
			() => client.createThread("t", "hi", [], "alma", "alma-x"),
			/explicit total message count/,
		);
		globalThis.fetch = async () =>
			jsonResponse(200, { thread: { thread_id: "alma-x", message_count: -1 } });
		await assert.rejects(
			() => client.createThread("t", "hi", [], "alma", "alma-x"),
			/explicit total message count/,
		);
		globalThis.fetch = async () =>
			jsonResponse(200, { thread: { thread_id: "alma-x", message_count: 2 } });
		const created = await client.createThread(
			"t",
			"",
			[{ role: "user", content: "a" }, { role: "assistant", content: "b" }],
			"alma",
			"alma-x",
		);
		assert.equal(created.id, "alma-x");
		assert.equal(created.total_messages, 2);
	} finally {
		globalThis.fetch = previous;
	}
});

function makePluginHarness(initialSettings = {}) {
	const store = {
		"nowledgeMem.recallPolicy": "off",
		"nowledgeMem.autoCapture": true,
		"nowledgeMem.autoRecall": false,
		...initialSettings,
	};
	const listeners = [];
	const tools = new Map();
	const events = new Map();
	return {
		tools,
		events,
		changeSettings(patch) {
			Object.assign(store, patch);
			for (const fn of listeners) fn();
		},
		context: {
			logger,
			settings: {
				get(key) {
					return store[key];
				},
				onDidChange(fn) {
					listeners.push(fn);
					return { dispose() {} };
				},
			},
			tools: {
				register(name, tool) {
					if (typeof name === "string") tools.set(name, tool);
					return { dispose() {} };
				},
			},
			events: {
				on(name, handler) {
					events.set(name, handler);
					return { dispose() {} };
				},
			},
		},
	};
}

async function captureUserAndAssistant(events, threadId = "thread-1") {
	await events.get("chat.message.willSend")({ threadId, content: "hello from alma" });
	events.get("chat.message.didReceive")({
		threadId,
		response: { content: "hi from mem" },
	});
}

test("manual thread_create tool keeps the 15s timeout while automatic flush uses NMEM_SYNC_TIMEOUT_MS", async () => {
	const previousFetch = globalThis.fetch;
	const previousEnv = process.env.NMEM_SYNC_TIMEOUT_MS;
	const originalFetch = NowledgeMemClient.prototype._fetch;
	const calls = [];
	NowledgeMemClient.prototype._fetch = async function (method, path, options = {}) {
		calls.push({ method, path, timeout: options.timeout, apiUrl: this._apiUrl });
		if (String(path).includes("/append")) {
			const err = new Error("HTTP 404: Thread not found");
			err.status = 404;
			throw err;
		}
		if (method === "POST" && path === "/threads") {
			return {
				thread: {
					thread_id: options.body?.thread_id || "alma-x",
					message_count: Array.isArray(options.body?.messages) ? options.body.messages.length : 1,
				},
			};
		}
		return {};
	};
	process.env.NMEM_SYNC_TIMEOUT_MS = "90000";
	const harness = makePluginHarness();
	const plugin = await activate(harness.context);
	try {
		await captureUserAndAssistant(harness.events);
		await harness.events.get("app.willQuit")({}, { cancel: false });
		const autoCreate = calls.find((call) => call.method === "POST" && call.path === "/threads");
		assert.equal(autoCreate?.timeout, 90_000);

		calls.length = 0;
		const tool = harness.tools.get("nowledge_mem_thread_create");
		const result = await tool.execute({ title: "manual", content: "hello" });
		assert.equal(result.ok, true);
		assert.equal(calls[0].path, "/threads");
		assert.equal(calls[0].timeout, undefined);
	} finally {
		NowledgeMemClient.prototype._fetch = originalFetch;
		globalThis.fetch = previousFetch;
		if (previousEnv === undefined) delete process.env.NMEM_SYNC_TIMEOUT_MS;
		else process.env.NMEM_SYNC_TIMEOUT_MS = previousEnv;
		await plugin.dispose();
	}
});

test("flush discards a stale ack after the destination changes and reruns", async () => {
	const previous = globalThis.fetch;
	const posts = [];
	const harness = makePluginHarness();
	globalThis.fetch = async (url, init) => {
		const href = String(url);
		const body = init?.body ? JSON.parse(init.body) : undefined;
		posts.push({ href, body });
		if (href.includes("/append") && posts.filter((post) => post.href.includes("127.0.0.1")).length === 1) {
			harness.changeSettings({ "nowledgeMem.apiUrl": "http://mem-b:14242" });
		}
		if (href.includes("/append")) {
			return jsonResponse(200, {
				success: true,
				append_mode: "checkpointed",
				messages_added: 2,
				total_messages: 2,
			});
		}
		return jsonResponse(200, {
			thread: { thread_id: body?.thread_id || "alma-x", message_count: 2 },
		});
	};
	const plugin = await activate(harness.context);
	try {
		await captureUserAndAssistant(harness.events);
		await harness.events.get("app.willQuit")({}, { cancel: false });
		const appends = posts.filter((post) => post.href.includes("/append"));
		assert.equal(appends.length, 2);
		assert.match(appends[0].href, /127\.0\.0\.1/);
		assert.match(appends[1].href, /mem-b:14242/);
	} finally {
		globalThis.fetch = previous;
		await plugin.dispose();
	}
});

test("in-flight flush keeps its stable thread id after a destination reset", async () => {
	const previous = globalThis.fetch;
	const harness = makePluginHarness();
	let releaseTitle;
	let titleCalls = 0;
	const titleStarted = new Promise((resolve) => {
		harness.context.chat = {
			getThread() {
				titleCalls += 1;
				if (titleCalls > 1) return Promise.resolve({ title: "Resolved title" });
				resolve();
				return new Promise((finish) => {
					releaseTitle = finish;
				});
			},
		};
	});
	const calls = [];
	globalThis.fetch = async (url, init) => {
		const href = String(url);
		const body = init?.body ? JSON.parse(init.body) : undefined;
		calls.push({ href, body });
		if (href.includes("/append")) {
			return jsonResponse(404, { detail: "Thread not found" });
		}
		return jsonResponse(200, {
			thread: { thread_id: body.thread_id, message_count: body.messages.length },
		});
	};
	const plugin = await activate(harness.context);
	try {
		await captureUserAndAssistant(harness.events);
		const flushing = harness.events.get("app.willQuit")({}, { cancel: false });
		await titleStarted;
		harness.changeSettings({ "nowledgeMem.apiUrl": "http://mem-b:14242" });
		releaseTitle({ title: "Resolved title" });
		await flushing;

		const oldAppend = calls.find((call) => call.href.includes("127.0.0.1") && call.href.includes("/append"));
		const oldCreate = calls.find((call) => call.href === "http://127.0.0.1:14242/threads");
		assert.ok(oldAppend);
		assert.ok(oldCreate);
		assert.doesNotMatch(oldAppend.href, /\/threads\/null\/append/);
		assert.match(oldAppend.href, new RegExp(`/threads/${oldCreate.body.thread_id}/append$`));
	} finally {
		globalThis.fetch = previous;
		await plugin.dispose();
	}
});

test("automatic flush leaves a user-only tail buffered until its assistant arrives", async () => {
	const previous = globalThis.fetch;
	const appends = [];
	globalThis.fetch = async (url, init) => {
		if (String(url).includes("/append")) {
			const body = JSON.parse(init.body);
			appends.push(body.messages);
			return jsonResponse(200, {
				success: true,
				append_mode: "checkpointed",
				messages_added: body.messages.length,
				total_messages: appends.flat().length,
			});
		}
		return jsonResponse(200, {});
	};
	const harness = makePluginHarness();
	const plugin = await activate(harness.context);
	try {
		await captureUserAndAssistant(harness.events);
		await harness.events.get("chat.message.willSend")({
			threadId: "thread-1",
			content: "pending question",
		});
		await harness.events.get("app.willQuit")({}, { cancel: false });
		assert.deepEqual(appends, [[
			{ role: "user", content: "hello from alma" },
			{ role: "assistant", content: "hi from mem" },
		]]);

		harness.events.get("chat.message.didReceive")({
			threadId: "thread-1",
			response: { content: "pending answer" },
		});
		await harness.events.get("app.willQuit")({}, { cancel: false });
		assert.deepEqual(appends[1], [
			{ role: "user", content: "pending question" },
			{ role: "assistant", content: "pending answer" },
		]);
	} finally {
		globalThis.fetch = previous;
		await plugin.dispose();
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
	const upstream = new Error("HTTP 500: upstream thread not found");
	upstream.status = 500;
	assert.equal(client.isThreadNotFoundError(upstream), false);
});
