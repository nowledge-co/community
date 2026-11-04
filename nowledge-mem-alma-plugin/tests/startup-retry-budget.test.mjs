import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import { fixture } from "./sync-fixture.mjs";

async function advance(t, milliseconds) {
	t.mock.timers.tick(milliseconds);
	await setImmediate();
}

async function runClock(t, seconds) {
	for (let second = 0; second < seconds; second += 1) await advance(t, 1_000);
}

for (const legacy of [false, true]) {
	test(`startup retry budget: ${legacy ? "legacy" : "expired"} unanswered turns get one read on each restart`, async (t) => {
		const state = await fixture(t);
		t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
		t.after(() => t.mock.timers.reset());
		const first = await state.start({ recordsDriven: true });
		for (let index = 0; index < 10; index += 1) {
			state.persist(`thread-${index}`, "user", "unanswered question", `user-${index}`);
			await first.events.get("chat.message.willSend")({ threadId: `thread-${index}`, content: "unanswered question" });
		}
		await first.plugin.dispose();
		if (legacy) {
			const path = join(state.storagePath, "thread-sync-outbox.json");
			const records = JSON.parse(readFileSync(path, "utf8"));
			for (const record of records) delete record.captureRetryUntil;
			writeFileSync(path, JSON.stringify(records));
		}
		await advance(t, 600_001);
		for (let restart = 0; restart < 2; restart += 1) {
			let reads = 0;
			const host = await state.start({ recordsDriven: true, context: { chat: {
				getMessages: async (id) => {
					reads += 1;
					if (id === "thread-0") throw new Error("Synthetic deleted thread");
					return structuredClone(state.histories.get(id) ?? []);
				},
			} } });
			await runClock(t, 700);
			assert.equal(reads, 10, `restart ${restart + 1} must not renew old unanswered turns`);
			assert.equal(state.calls.length, 0);
			assert.equal(state.records().length, 10, "pending canonical data remains recoverable");
			await host.plugin.dispose();
		}
	});
}

test("startup retry budget: a recent restart uses only the remaining activity window", async (t) => {
	const state = await fixture(t);
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	t.after(() => t.mock.timers.reset());
	const first = await state.start({ recordsDriven: true });
	state.persist("thread", "user", "question", "user-id");
	await first.events.get("chat.message.willSend")({ threadId: "thread", content: "question" });
	await first.plugin.dispose();
	const deadline = state.receipts()[0].captureRetryUntil;
	await advance(t, 590_000);
	let reads = 0;
	await state.start({ recordsDriven: true, context: { chat: {
		getMessages: async (id) => { reads += 1; return structuredClone(state.histories.get(id) ?? []); },
	} } });
	await runClock(t, 90);
	assert.equal(reads, 2, "the startup read and final read must stop at the original deadline");
	assert.equal(state.calls.length, 0);
	assert.equal(state.receipts()[0].captureRetryUntil, deadline);
});

test("startup retry budget: live activity renews an expired window and recovers a late reply", async (t) => {
	const state = await fixture(t);
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	t.after(() => t.mock.timers.reset());
	const first = await state.start({ recordsDriven: true });
	state.persist("thread", "user", "question", "user-id");
	await first.events.get("chat.message.willSend")({ threadId: "thread", content: "question" });
	await first.plugin.dispose();
	await advance(t, 700_000);
	let reads = 0;
	const host = await state.start({ recordsDriven: true, context: { chat: {
		getMessages: async (id) => { reads += 1; return structuredClone(state.histories.get(id) ?? []); },
	} } });
	await runClock(t, 60);
	assert.equal(reads, 1, "an expired restored record has only one startup read");
	await host.events.get("thread.activated")({ threadId: "thread" });
	await advance(t, 7_000);
	state.persist("thread", "assistant", "late answer", "assistant-id");
	await advance(t, 14_000);
	await state.waitForRequest();
	await host.quit();
	assert.deepEqual([...state.remote.values()].flat().map(({ external_id }) => external_id), ["user-id", "assistant-id"]);
	assert.ok(state.receipts()[0].captureRetryUntil > Date.now(), "live activity journals the renewed window");
});
