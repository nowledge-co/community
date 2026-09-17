import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { fixture } from "./sync-fixture.mjs";

import { activate, NowledgeMemClient } from "../main.js";

const logger = { info() {}, warn() {}, debug() {}, error() {} };

test("user Given an acknowledged prefix When a new message is appended Then the protocol advances the checkpoint without duplicating the prefix", async (t) => {
	const state = await fixture(t);
	const client = new NowledgeMemClient(logger, { apiUrl: state.apiUrl });
	await client.createThread("synthetic", "", [{ role: "user", content: "first" }, { role: "assistant", content: "answer" }], "alma", "alma-x");
	const messages = [{ role: "user", content: "next", external_id: "synthetic-next" }];
	const checkpoint = { idempotencyKey: "alma-thread:alma-x:2-3:synthetic", expectedMessageCount: 2 };
	await client.appendThread("alma-x", messages, checkpoint);
	await client.appendThread("alma-x", messages, checkpoint);
	assert.deepEqual(state.remote.get("alma-x"), [{ role: "user", content: "first" }, { role: "assistant", content: "answer" }, ...messages]);
});

for (const [scenario, body, expected] of [
	["success without persistence", { success: true }, /explicit persistence acknowledgement/],
	["an uncheckpointed reply", { success: true, messages_added: 1, total_messages: 2 }, /not acknowledged as checkpointed/],
]) {
	test(`user Given ${scenario} When the server responds to a checkpointed append Then the caller is told persistence is unconfirmed`, async (t) => {
		const state = await fixture(t);
		state.replyWith(200, body);
		const client = new NowledgeMemClient(logger, { apiUrl: state.apiUrl });
		await assert.rejects(client.appendThread("alma-x", [{ role: "user", content: "hi" }], { expectedMessageCount: 1 }), expected);
	});
}

for (const [scenario, body, expected] of [
	["missing identity", {}, /thread identity/],
	["missing message count", { thread: { thread_id: "alma-x" } }, /explicit total message count/],
	["negative message count", { thread: { thread_id: "alma-x", message_count: -1 } }, /explicit total message count/],
]) {
	test(`user Given a create response with ${scenario} When saving a conversation Then persistence is not falsely confirmed`, async (t) => {
		const state = await fixture(t);
		state.replyWith(200, body);
		const client = new NowledgeMemClient(logger, { apiUrl: state.apiUrl });
		await assert.rejects(client.createThread("synthetic", "", [], "alma", "alma-x"), expected);
	});
}

for (const operation of ["manual create", "manual tool", "automatic create", "automatic append"]) {
	test(`user Given a stalled server When ${operation} reaches its deadline Then the request aborts only at its configured budget`, { timeout: 5_000 }, async (t) => {
		t.after(() => t.mock.timers.reset());
		const state = await fixture(t);
		state.setMode("hang");
		const client = new NowledgeMemClient(logger, { apiUrl: state.apiUrl, threadSyncTimeoutMs: 90_000 });
		const tools = new Map();
		await state.start({ context: { tools: { register(name, tool) { tools.set(name, tool); return { dispose() {} }; } } } });
		t.mock.timers.enable({ apis: ["setTimeout"] });
		const budget = operation.startsWith("manual") ? 30_000 : 90_000;
		let completed = false;
		const request = operation === "manual tool"
			? tools.get("nowledge_mem_thread_create").execute({ title: "synthetic", content: "hi" })
			: operation === "automatic append"
				? client.appendThread("alma-x", [{ role: "user", content: "hi" }])
				: client.createThread("synthetic", "", [{ role: "user", content: "hi" }], "alma", "alma-x", operation === "automatic create" ? { timeout: 90_000 } : undefined);
		const outcome = request.then((value) => { completed = true; return value; }, (error) => { completed = true; return { error }; });
		await state.waitForRequest();
		t.mock.timers.tick(budget - 1);
		await new Promise((resolve) => setImmediate(resolve));
		assert.equal(completed, false, "the user still has their full request budget");
		t.mock.timers.tick(1);
		const result = await outcome;
		assert.ok(result.error);
		if (operation === "manual tool") assert.equal(result.ok, false);
		else assert.equal(result.error.name, "AbortError");
	});
}

function makePluginHarness(initialSettings = {}) {
	const store = {
		"nowledgeMem.recallPolicy": "off",
		"nowledgeMem.autoCapture": true,
		"nowledgeMem.autoRecall": false,
		"nowledgeMem.apiUrl": "http://127.0.0.1:1",
		...initialSettings,
	};
	const listeners = [];
	const tools = new Map();
	const events = new Map();
	const histories = new Map();
	let sequence = 0;
	return {
		tools,
		events,
		changeSettings(patch) {
			Object.assign(store, patch);
			for (const fn of listeners) fn();
		},
		context: {
			logger,
			chat: { getMessages: async (threadId) => structuredClone(histories.get(threadId) ?? []) },
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
					events.set(name, async (input, output) => {
						const role = name === "chat.message.willSend" ? "user" : name === "chat.message.didReceive" ? "assistant" : null;
						if (role) {
							const records = histories.get(input.threadId) ?? [];
							const id = `synthetic-${++sequence}`;
							const text = role === "user" ? input.content : input.response.content;
							records.push({ id, role, createdAt: new Date().toISOString(), content: { parts: [{ type: "text", text }] } });
							histories.set(input.threadId, records);
						}
						return handler(input, output);
					});
					return { dispose() {} };
				},
			},
		},
	};
}

async function captureUserAndAssistant(events, threadId = "thread-1") {
	await events.get("chat.message.willSend")({ threadId, content: "hello from alma" });
	await events.get("chat.message.didReceive")({
		threadId,
		response: { content: "hi from mem" },
	});
}

test("user Given an old destination has an unacknowledged turn When the destination changes before ACK Then the new destination receives the complete retained turn", { timeout: 5_000 }, async (t) => {
	const oldDestination = await fixture(t);
	const newDestination = await fixture(t);
	const host = await oldDestination.start();
	await host.turn();
	const release = oldDestination.holdNextResponse();
	const switching = host.flush();
	await oldDestination.waitForRequest();
	host.change({ "nowledgeMem.apiUrl": newDestination.apiUrl });
	release();
	await switching;
	await host.quit();
	const expected = oldDestination.histories.get("thread").map((record) => ({ role: record.role, content: record.content.parts[0].text, external_id: record.id }));
	assert.deepEqual([...oldDestination.remote.values()].flat(), expected);
	assert.deepEqual([...newDestination.remote.values()].flat(), expected);
	const pending = oldDestination.records();
	assert.equal(pending.length, 1);
	assert.deepEqual(pending[0].messages, expected);
	assert.equal(pending[0].savedCount, 0);
	assert.ok(pending[0].attempt, "the obsolete ACK cannot clear the old destination's recoverable attempt");
});

test("user Given a pending title lookup When the destination changes Then the old destination keeps its frozen turn and the new destination receives retained live history", { timeout: 5_000 }, async (t) => {
	const calls = [];
	const handleRequest = (destination) => async (request, response) => {
		let content = "";
		for await (const chunk of request) content += chunk;
		const body = JSON.parse(content);
		calls.push({ path: "/" + destination + request.url, body });
		response.setHeader("content-type", "application/json");
		if (request.url.endsWith("/append")) {
			response.writeHead(404);
			response.end(JSON.stringify({ detail: "Thread not found" }));
		} else {
			response.end(JSON.stringify({ thread: { thread_id: body.thread_id, message_count: body.messages.length } }));
		}
	};
	const server = createServer(handleRequest("old"));
	const destinationServer = createServer(handleRequest("new"));
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	await new Promise((resolve) => destinationServer.listen(0, "127.0.0.1", resolve));
	const origin = `http://127.0.0.1:${server.address().port}`;
	const destination = `http://127.0.0.1:${destinationServer.address().port}`;
	const harness = makePluginHarness({ "nowledgeMem.apiUrl": origin });
	let releaseTitle;
	let titleResolved = false;
	const titleStarted = new Promise((resolve) => {
		harness.context.chat.getThread = () => {
			if (titleResolved) return Promise.resolve({ title: "Resolved title" });
			resolve();
			return new Promise((finish) => { releaseTitle = finish; });
		};
	});
	const plugin = await activate(harness.context);
	t.after(async () => {
		titleResolved = true;
		releaseTitle?.({ title: "Resolved title" });
		await plugin.dispose();
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
		destinationServer.closeAllConnections();
		await new Promise((resolve) => destinationServer.close(resolve));
	});
	await captureUserAndAssistant(harness.events);
	const switching = harness.events.get("thread.activated")({ threadId: "away" });
	await titleStarted;
	harness.changeSettings({ "nowledgeMem.apiUrl": destination });
	await harness.events.get("chat.message.willSend")({ threadId: "thread-1", content: "DESTINATION_B_ONLY_USER" });
	await harness.events.get("chat.message.didReceive")({ threadId: "thread-1", response: { content: "DESTINATION_B_ONLY_ASSISTANT" } });
	titleResolved = true;
	releaseTitle({ title: "Resolved title" });
	await switching;
	await harness.events.get("app.willQuit")({}, { cancel: false });
	const oldCreate = calls.find((call) => call.path === "/old/threads");
	const newCreate = calls.find((call) => call.path === "/new/threads");
	assert.ok(oldCreate);
	assert.ok(newCreate);
	assert.deepEqual(oldCreate.body.messages.map(({ content }) => content), ["hello from alma", "hi from mem"]);
	assert.deepEqual(newCreate.body.messages.map(({ content }) => content), ["hello from alma", "hi from mem", "DESTINATION_B_ONLY_USER", "DESTINATION_B_ONLY_ASSISTANT"]);
	assert.ok(calls.some((call) => call.path === "/old/threads/" + oldCreate.body.thread_id + "/append"));
	assert.ok(calls.some((call) => call.path === "/new/threads/" + newCreate.body.thread_id + "/append"));
});

for (const evicted of [false, true]) {
	test(`user Given an acknowledged turn and an incomplete tail${evicted ? " evicted from memory" : ""} When the assistant arrives after quit Then only the complete canonical turns reach memory`, { timeout: 5_000 }, async (t) => {
		const state = await fixture(t);
		const host = await state.start();
		await host.turn("oldest");
		await host.flush();
		await host.events.get("chat.message.willSend")({ threadId: "oldest", content: "pending question" });
		if (evicted) {
			for (let index = 0; index < 20; index += 1) {
				await host.events.get("chat.message.willSend")({ threadId: "other-" + index, content: "user only" });
			}
		}
		await host.quit();
		assert.deepEqual([...state.remote.values()].flat().map(({ content }) => content), ["first user", "first assistant"]);
		await host.events.get("chat.message.didReceive")({ threadId: "oldest", response: { content: "pending answer" } });
		await host.quit();
		const expected = state.histories.get("oldest").map((record) => ({ role: record.role, content: record.content.parts[0].text, external_id: record.id }));
		assert.deepEqual([...state.remote.values()].flat(), expected);
		assert.equal(state.records().some((record) => record.threadId === "oldest"), false);
		await host.plugin.dispose();
		assert.deepEqual([...state.remote.values()].flat(), expected);
	});
}

for (const teardown of ["quit", "dispose", "revisit", "retry"]) {
	test(`user Given an evicted turn awaiting delivery When ${teardown} occurs with a completed tail Then memory contains every canonical message exactly once`, { timeout: 5_000 }, async (t) => {
		const state = await fixture(t);
		const host = await state.start();
		const release = state.holdNextResponse();
		if (teardown === "retry") state.setMode("failure");
		await host.turn("oldest");
		const switching = host.flush();
		await state.waitForRequest();
		await host.turn("oldest", "tail");
		for (let index = 0; index < 20; index += 1) {
			await host.events.get("chat.message.willSend")({ threadId: "other-" + index, content: "user only" });
		}
		if (teardown === "revisit") await host.turn("oldest", "revisit");
		const closing = teardown === "dispose" ? host.plugin.dispose() : null;
		release();
		await switching;
		if (teardown === "retry") {
			assert.deepEqual([...state.remote.values()], []);
			assert.ok(state.records().some((record) => record.threadId === "oldest"));
			state.setMode("ok");
		}
		if (closing) await closing;
		else await host.quit();
		const expected = state.histories.get("oldest").map((record) => ({ role: record.role, content: record.content.parts[0].text, external_id: record.id }));
		assert.deepEqual([...state.remote.values()].flat(), expected);
		assert.equal(state.records().some((record) => record.threadId === "oldest"), false);
	});
}

test("user Given a failed append When only the thread is missing Then recovery allows recreation but never hides an upstream failure", () => {
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

for (const revisit of [false, true]) {
 test(revisit
  ? "user Given an old canonical read evicted from cache When a newer read saves the complete conversation Then the late read cannot roll durable recovery back"
  : "user Given a canonical read pending during eviction When it completes and quit follows Then the completed turn reaches memory", async t => {
  const state = await fixture(t);
  let releaseRead;
  let announceRead;
  let firstRead = true;
  const readStarted = new Promise(resolve => { announceRead = resolve; });
  const host = await state.start({ recordsDriven: true, context: { chat: {
   getMessages: async threadId => {
    const snapshot = structuredClone(state.histories.get(threadId) ?? []);
    if (threadId === "owned-target" && firstRead) {
     firstRead = false;
     announceRead();
     return new Promise(resolve => { releaseRead = () => resolve(snapshot); });
    }
    return snapshot;
   }
  } } });
  state.persist("owned-target", "user", "SYNTHETIC original");
  state.persist("owned-target", "assistant", "SYNTHETIC reply");
  const pending = host.events.get("chat.message.willSend")({ threadId: "owned-target", content: "SYNTHETIC enriched" });
  await readStarted;
  for (let index = 0; index < 24; index += 1) {
   const threadId = "owned-other-" + index;
   state.persist(threadId, "user", "SYNTHETIC pending");
   await host.events.get("chat.message.willSend")({ threadId, content: "SYNTHETIC enriched" });
  }
  const expected = ["SYNTHETIC original", "SYNTHETIC reply"];
  if (revisit) {
   state.persist("owned-target", "user", "SYNTHETIC tail");
   state.persist("owned-target", "assistant", "SYNTHETIC tail reply");
   await host.events.get("chat.message.didReceive")({ threadId: "owned-target" });
   expected.push("SYNTHETIC tail", "SYNTHETIC tail reply");
  }
  releaseRead();
  await pending;
  assert.deepEqual(state.receipts().find(record => record.threadId === "owned-target").messages.map(message => message.content), expected);
  await host.quit();
  assert.deepEqual([...state.remote.values()].flat().map(message => message.content), expected);
 });
}
