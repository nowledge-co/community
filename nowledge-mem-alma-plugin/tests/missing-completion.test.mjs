import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { fixture } from "./sync-fixture.mjs";

async function advance(t, milliseconds) {
	t.mock.timers.tick(milliseconds);
	await setImmediate();
}

test("missing completion: a new turn waits for storage even after an acknowledged assistant", async (t) => {
	const state = await fixture(t);
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	t.after(() => t.mock.timers.reset());
	const host = await state.start({ recordsDriven: true });
	state.persist("thread", "user", "first question", "user-1");
	state.persist("thread", "assistant", "first answer", "assistant-1");
	await host.events.get("thread.activated")({ threadId: "thread" });
	await host.flush();
	assert.equal([...state.remote.values()].flat().length, 2);
	await host.events.get("chat.message.willSend")({ threadId: "thread", content: "hook-only second question" });
	await advance(t, 7_000);
	state.persist("thread", "user", "second question", "user-2");
	state.persist("thread", "assistant", "second answer", "assistant-2");
	await advance(t, 14_000);
	await assert.doesNotReject(state.waitForRequest((call) => call.body.messages.some(({ external_id }) => external_id === "assistant-2")), "the second turn must sync without didReceive");
	await host.quit();
	assert.deepEqual([...state.remote.values()].flat().map(({ external_id }) => external_id), ["user-1", "assistant-1", "user-2", "assistant-2"]);
});

test("missing completion: restored user-only outbox retries until the assistant is stored", async (t) => {
	const state = await fixture(t);
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	t.after(() => t.mock.timers.reset());
	const first = await state.start({ recordsDriven: true });
	state.persist("thread", "user", "question", "user-id");
	await first.events.get("chat.message.willSend")({ threadId: "thread", content: "question" });
	await first.plugin.dispose();
	const restarted = await state.start({ recordsDriven: true });
	await advance(t, 7_000);
	state.persist("thread", "assistant", "late answer", "assistant-id");
	await advance(t, 14_000);
	await assert.doesNotReject(state.waitForRequest(), "restored pending turns need timer recovery");
	await restarted.quit();
	assert.deepEqual([...state.remote.values()].flat().map(({ external_id }) => external_id), ["user-id", "assistant-id"]);
});

for (const action of ["disable", "dispose", "destination"]) {
	test(`missing completion: ${action} during an idle read prevents stale uploads and retries`, async (t) => {
		const state = await fixture(t);
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
		t.after(() => t.mock.timers.reset());
		let reads = 0;
		let release;
		const host = await state.start({ recordsDriven: true, context: { chat: {
			getMessages: async () => {
				reads += 1;
				if (reads > 1) await new Promise((resolve) => { release = resolve; });
				return structuredClone(state.histories.get("thread") ?? []);
			},
		} } });
		state.persist("thread", "user", "question", "user-id");
		await host.events.get("chat.message.willSend")({ threadId: "thread", content: "question" });
		await advance(t, 7_000);
		assert.equal(reads, 2);
		if (action === "dispose") await host.plugin.dispose();
		else host.change(action === "disable" ? { "nowledgeMem.autoCapture": false } : { "nowledgeMem.apiKey": "new-synthetic-destination" });
		state.persist("thread", "assistant", "late answer", "assistant-id");
		release();
		await setImmediate();
		await advance(t, 60_000);
		assert.equal(state.calls.length, 0);
		assert.equal(reads, 2);
		assert.equal(state.records()[0].savedCount, 0);
		assert.equal(state.records()[0].messages.length, 1, "retired reads cannot capture the late assistant");
	});
}

test("missing completion: an old thread idle read does not replace the selected thread", async (t) => {
	const state = await fixture(t);
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	t.after(() => t.mock.timers.reset());
	const host = await state.start({ recordsDriven: true });
	state.persist("old", "user", "old pending question", "old-user");
	await host.events.get("chat.message.willSend")({ threadId: "old", content: "old pending question" });
	await advance(t, 1_000);
	state.persist("selected", "user", "selected question", "selected-user");
	await host.events.get("thread.activated")({ threadId: "selected" });
	await advance(t, 6_000);
	state.persist("selected", "assistant", "selected answer", "selected-assistant");
	await host.events.get("thread.activated")({ threadId: "next" });
	assert.deepEqual([...state.remote.values()].flat().map(({ external_id }) => external_id), ["selected-user", "selected-assistant"], "switching must flush the selected thread despite a background read of the old thread");
});

test("missing completion: idle reads back off and stop at a bounded deadline", async (t) => {
	const state = await fixture(t);
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	t.after(() => t.mock.timers.reset());
	let reads = 0;
	const warnings = [];
	const host = await state.start({ recordsDriven: true, context: {
		chat: { getMessages: async () => { reads += 1; return structuredClone(state.histories.get("thread") ?? []); } },
		logger: { info() {}, debug() {}, error() {}, warn(message) { warnings.push(message); } },
	} });
	state.persist("thread", "user", "question", "user-id");
	await host.events.get("chat.message.willSend")({ threadId: "thread", content: "question" });
	for (const interval of [7_000, 14_000, 28_000]) await advance(t, interval);
	assert.equal(reads, 4);
	for (let index = 0; index < 18; index += 1) await advance(t, 30_000);
	await advance(t, 11_000);
	assert.equal(warnings.filter((message) => message.includes("no complete stored reply")).length, 1);
	const stopped = reads;
	await advance(t, 600_000);
	assert.equal(reads, stopped);
	assert.equal(state.calls.length, 0);
	assert.equal(state.records()[0].messages[0].external_id, "user-id");
});

for (const initiallyStored of [true, false]) {
	test(`missing completion: late assistant syncs after an initially ${initiallyStored ? "stored" : "invisible"} user without didReceive`, async (t) => {
		const state = await fixture(t);
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
		t.after(() => t.mock.timers.reset());
		const host = await state.start({ recordsDriven: true });
		if (initiallyStored) state.persist("thread", "user", "stored question", "user-id");
		await host.events.get("chat.message.willSend")({ threadId: "thread", content: "hook-only text" });
		await advance(t, 7_000);
		assert.equal(state.calls.length, 0, "a partial turn must not upload");
		if (!initiallyStored) state.persist("thread", "user", "stored question", "user-id");
		state.persist("thread", "assistant", "stored answer without usage", "assistant-id");
		await advance(t, 14_000);
		await assert.doesNotReject(state.waitForRequest(), "idle retries must start persistence without another host event");
		await host.quit();
		assert.deepEqual([...state.remote.values()].flat().map(({ external_id, content }) => [external_id, content]), [
			["user-id", "stored question"],
			["assistant-id", "stored answer without usage"],
		]);
	});
}
