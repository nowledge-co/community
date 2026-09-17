import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, mock } from "node:test";

import { fixture } from "./sync-fixture.mjs";

mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
after(() => mock.timers.reset());

test("user Given a stalled host record read When virtual time advances Then the independent native AbortSignal deadline still bounds capture", { timeout: 4_000 }, async (t) => {
	const state = await fixture(t);
	const host = await state.start({ recordsDriven: true, context: { chat: { getMessages: () => new Promise(() => {}) } } });
	let settled = false;
	const started = performance.now();
	const capturing = host.events.get("chat.message.willSend")({ threadId: "synthetic-hang", content: "SYNTHETIC_ENHANCED" }).then(() => { settled = true; });
	mock.timers.tick(2_000);
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(settled, false, "Node virtual setTimeout/Date do not control native AbortSignal.timeout");
	await capturing;
	assert.ok(performance.now() - started >= 1_900);
	assert.equal(state.errors.length, 1);
	assert.match(state.errors[0], /cancelled or timed out/);
	assert.equal(state.calls.length, 0);
	assert.deepEqual(state.records(), []);
});

test("user Given unreadable canonical records When the real disk record is repaired Then capture retries once without leaking rejected content", async (t) => {
	const state = await fixture(t);
	const path = join(state.storagePath, "canonical.json");
	writeFileSync(path, '{"PRIVATE_CANONICAL_CANARY":');
	const host = await state.start({ recordsDriven: true, context: { chat: { getMessages: async (threadId) => threadId === "thread" ? JSON.parse(readFileSync(path, "utf8")) : [] } } });
	const trigger = () => host.events.get("chat.message.willSend")({ threadId: "thread", content: "SYNTHETIC_ENHANCED" });
	await trigger();
	assert.equal(state.errors.length, 1);
	assert.doesNotMatch(state.errors.join("\n"), /PRIVATE_CANONICAL_CANARY/);
	assert.equal(state.calls.length, 0);
	state.persist("thread", "user", "SYNTHETIC_ORIGINAL", "user-original");
	state.persist("thread", "assistant", "SYNTHETIC_REPLY", "assistant-original");
	writeFileSync(path, JSON.stringify(state.histories.get("thread")));
	await trigger();
	await trigger();
	await host.flush();
	assert.deepEqual([...state.remote.values()][0].map(({ external_id }) => external_id), ["user-original", "assistant-original"]);
	assert.deepEqual(state.records(), []);
	assert.equal(state.errors.length, 1);
});

test("user Given capture awaiting host records When disposal completes before the read Then late records cannot mutate storage or send HTTP", async (t) => {
	const state = await fixture(t);
	let release;
	const host = await state.start({ recordsDriven: true, context: { chat: { getMessages: () => new Promise((resolve) => { release = resolve; }) } } });
	const capturing = host.events.get("chat.message.willSend")({ threadId: "thread", content: "SYNTHETIC_ENHANCED" });
	await host.plugin.dispose();
	await capturing;
	const checkpoint = state.receipts();
	state.persist("thread", "user", "SYNTHETIC_LATE", "late-user");
	release(state.histories.get("thread"));
	await new Promise((resolve) => setImmediate(resolve));
	mock.timers.tick(120_000);
	assert.deepEqual(state.receipts(), checkpoint);
	assert.equal(state.calls.length, 0);
	assert.equal(state.errors.length, 1);
});

test("user Given a thread switch awaiting delivery When quit exhausts its budget Then late work cannot reopen sync or alter durable recovery", { timeout: 5_000 }, async (t) => {

	const f = await fixture(t);
	const instance = await f.start();
	await instance.turn();
	f.setMode("hang");

	const switching = instance.events.get("thread.activated")({ threadId: "away" });
	await f.waitForRequest();
	const checkpoint = f.receipts();
	const quitting = instance.quit();
	mock.timers.tick(2_500);
	await quitting;
	await f.waitForClosed(1);
	await switching;
	assert.deepEqual(f.receipts(), checkpoint, "finished quit must not create a checkpoint for a stale activation");
	const delivered = structuredClone([...f.remote]);
	await instance.plugin.dispose();
	assert.deepEqual([...f.remote], delivered, "dispose must retain the finished quit boundary");
});

for (const shape of ["single original part", "multiple enhanced parts"]) {
 test(`user Given independently persisted original text and ${shape} When enhanced hooks complete Then outbox and HTTP contain only canonical text`, async (t) => {
	const state = await fixture(t);
	const original = "SYNTHETIC_ORIGINAL_MARKER";
	const threadId = "synthetic-canonical-capture";
	const persisted = {
		id: "synthetic-user-1",
		threadId,
		role: "user",
		content: {
			id: "synthetic-user-1",
			role: "user",
			parts: [{ type: "text", text: original }],
		},
		createdAt: "2026-01-01T00:00:00.000Z",
	};
	const host = await state.start({ recordsDriven: true });
	persisted.createdAt = new Date().toISOString();
	state.histories.set(threadId, [persisted]);
	const input = {
		threadId,
		content: `SYNTHETIC_MODEL_CONTEXT\n${original}`,
		parts: shape === "single original part" ? [{ type: "text", text: original }] : [
			{ type: "text", text: "SYNTHETIC_MODEL_CONTEXT" },
			{ type: "text", text: original },
		],
	};
	const output = { content: `SYNTHETIC_RECALL_CONTEXT\n${input.content}` };
	const unchangedInput = structuredClone(input);
	const unchangedOutput = structuredClone(output);
	await host.events.get("chat.message.willSend")(input, output);
	const captured = state.records()[0].messages[0];
	state.persist(threadId, "assistant", "SYNTHETIC_ASSISTANT", "synthetic-assistant-1");
	await host.events.get("chat.message.didReceive")({
		threadId,
		response: { content: "SYNTHETIC_ASSISTANT" },
	});
	await host.flush();
	assert.deepEqual(input, unchangedInput);
	assert.deepEqual(output, unchangedOutput);
	assert.ok(state.calls.length > 0);
	await t.test("user Given canonical capture When inspecting durable outbox Then only original user text is stored", () => {
		assert.equal(captured.content, original);
		assert.doesNotMatch(captured.content, /SYNTHETIC_(MODEL|RECALL)_CONTEXT/);
	});
	await t.test("user Given canonical capture When inspecting HTTP Then only original user text is transmitted", () => {
		for (const call of state.calls) {
			assert.equal(call.body.messages[0].content, original);
			assert.doesNotMatch(call.body.messages[0].content, /SYNTHETIC_(MODEL|RECALL)_CONTEXT/);
		}
	});
});

}

test("user Given old history and equal text with distinct IDs When records are reread Then only current IDs are delivered once", async (t) => {
	const state = await fixture(t);
	state.persist("thread", "user", "SYNTHETIC_OLD", "old-u", "2020-01-01T00:00:00Z");
	state.persist("thread", "assistant", "SYNTHETIC_OLD_REPLY", "old-a", "2020-01-01T00:00:01Z");
	const host = await state.start({ recordsDriven: true });
	state.persist("thread", "user", "SYNTHETIC_SAME", "u1");
	state.persist("thread", "user", "SYNTHETIC_SAME", "u2");
	const trigger = () => host.events.get("chat.message.willSend")({ threadId: "thread", content: "SYNTHETIC_MODEL_CONTEXT" }, { content: "SYNTHETIC_RECALL_CONTEXT" });
	await Promise.all([trigger(), trigger()]);
	assert.deepEqual(state.records()[0].messages.map(({ content, external_id }) => [content, external_id]), [["SYNTHETIC_SAME", "u1"], ["SYNTHETIC_SAME", "u2"]]);
	state.persist("thread", "assistant", "SYNTHETIC_REPLY", "a1");
	await host.events.get("chat.message.didReceive")({ threadId: "thread", response: { content: "SYNTHETIC_MODEL_CONTEXT" } });
	await host.flush();
	await trigger();
	await host.flush();
	assert.deepEqual([...state.remote.values()].flat().map(({ external_id }) => external_id), ["u1", "u2", "a1"]);
	assert.doesNotMatch(JSON.stringify(state.calls), /SYNTHETIC_(OLD|MODEL|RECALL)/);
});

test("user Given a normal automatic request When virtual time exceeds the quit budget Then HTTP can still succeed", async (t) => {
	const state = await fixture(t);

	const release = state.holdNextResponse();
	const host = await state.start();
	await host.turn();

	const flushing = host.flush();
	await state.waitForRequest();
	mock.timers.tick(2_700);
	assert.equal(state.closed, 0);
	release();
	await flushing;
	assert.deepEqual([...state.remote.values()].flat().map(message => message.content), ["first user", "first assistant"]);
	assert.equal(state.closed, 0);
	assert.deepEqual(state.records(), []);
});

test("user Given multiple in-flight threads When duplicate quit and dispose run Then one deadline closes all sockets", async (t) => {
	const state = await fixture(t);
	state.setMode("hang");
	const host = await state.start();
	await host.turn("first");
	const running = host.flush();
	await state.waitForRequest();
	await host.turn("second");
	await host.turn("third");

	const finishing = Promise.all([host.quit(), host.quit(), host.plugin.dispose(), running]);
	await state.waitForRequest(() => state.calls.length === 3);
	mock.timers.tick(2_499);
	assert.equal(state.closed, 0);
	mock.timers.tick(1);
	await finishing;
	await state.waitForClosed(3);
	assert.equal(state.calls.length, 3);
	assert.equal(host.events.size, 0);
	assert.ok(
		state
			.records()
			.every(
				(record) =>
					record.savedCount === 0 &&
					record.acknowledged === null &&
					record.attempt,
			),
	);
});

test("user Given a stalled response body When dispose reaches its deadline Then the socket closes and the journal remains", async (t) => {
	const state = await fixture(t);
	state.setMode("body-hang");
	const host = await state.start();
	await host.turn();

	const disposing = host.plugin.dispose();
	await state.waitForRequest();

	mock.timers.tick(4_499);
	assert.equal(state.closed, 0);
	mock.timers.tick(1);

	await disposing;

	await state.waitForClosed(1);

	assert.equal(state.records()[0].savedCount, 0);
	assert.equal(state.calls.length, 1);
});

test("user Given a pending title lookup When teardown runs Then fallback content is sent and late title does not restart work", async (t) => {
	const state = await fixture(t);
	let release;
	let titleCalls = 0;
	let started;
	const titleStarted = new Promise((resolve) => { started = resolve; });
	const host = await state.start({
		context: {
			chat: {
				getThread() {
					titleCalls += 1;
				started();
					return new Promise((resolve) => {
						release = resolve;
					});
				},
				getActiveThread() {
					titleCalls += 1;
					throw new Error("must not run after abort");
				},
			},
		},
	});
	await host.turn();
	const running = host.flush();
	await titleStarted;
	const start = Date.now();
	await Promise.all([host.quit(), running]);
	assert.ok(Date.now() - start < 2_500);
	const settledRequests = state.calls.length;
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["first user", "first assistant"],
	);
	assert.deepEqual(state.records(), []);
	release({ title: "late" });
	await new Promise((resolve) => setImmediate(resolve));
	assert.equal(titleCalls, 1);
	assert.equal(state.calls.length, settledRequests);
	assert.deepEqual(state.records(), []);
});

test("user Given a hung title lookup When quit begins Then fallback HTTP shares the original deadline", async (t) => {
	const state = await fixture(t);
	state.setMode("hang");
	let started;
	const titleStarted = new Promise((resolve) => { started = resolve; });
	const host = await state.start({
		context: {
			chat: {
				getThread() {
					started();
					return new Promise(() => {});
				},
			},
		},
	});
	await host.turn();
	const running = host.flush();
	await titleStarted;

	const quitting = host.quit();
	await state.waitForRequest();
	mock.timers.tick(2_500);
	await Promise.all([quitting, running]);
	await state.waitForClosed(1);
	assert.equal(state.calls.length, 1);
	assert.equal(state.records()[0].savedCount, 0);
	assert.ok(state.records()[0].attempt);
});

for (const outcome of ["hang", "lost", "create-lost"]) {
	test(`user Given ${outcome} before acknowledgement When restarting Then the frozen batch replays without duplicate messages`, async (t) => {
		const state = await fixture(t);
		state.setMode(outcome);
		const host = await state.start();
		await host.turn();
		const running = host.flush();
		await state.waitForRequest(call => outcome === "hang" ? call.path.includes("/append") : call.path === "/threads");
		await host.turn("thread", "later");

		const quitting = host.quit();
		mock.timers.tick(2_500);
		await Promise.all([quitting, running]);
		await state.waitForClosed(1);
		const before = state.records()[0];
		assert.equal(before.savedCount, 0);
		assert.equal(before.messages.length, 4);
		assert.equal(before.attempt.snapshot.length, 2);
		await host.plugin.dispose();
		state.setMode("ok");
		const restarted = await state.start();
		await restarted.quit();
		const appends = state.calls.filter((call) => call.path.includes("/append"));
		assert.equal(
			appends[0].body.idempotency_key,
			appends[1].body.idempotency_key,
		);
		assert.deepEqual(
			[...state.remote.values()][0].map((message) => message.content),
			["first user", "first assistant", "later user", "later assistant"],
		);
		assert.deepEqual(state.records(), []);
		const byKey = new Map(appends.map((append) => [append.body.idempotency_key, append.body]));
		assert.equal(byKey.size, 2);
		for (const append of appends) {
			assert.deepEqual(append.body, byKey.get(append.body.idempotency_key));
		}
	});
}

test("user Given a lost checkpointed ACK When restarting Then the same key count and payload replay exactly once", async (t) => {
	const state = await fixture(t);
	const host = await state.start();
	await host.turn();
	await host.flush();
	state.setMode("lost");
	await host.turn("thread", "next");

	const quitting = host.quit();
	await state.waitForRequest(call => call.body.expected_message_count === 2);
	mock.timers.tick(2_500);
	await quitting;
	await state.waitForClosed(1);
	assert.equal(state.records()[0].savedCount, 2);
	await host.plugin.dispose();
	state.setMode("ok");
	const restarted = await state.start();
	await restarted.quit();
	const retries = state.calls.filter(call => call.body.expected_message_count === 2);
	assert.equal(retries.length, 2);
	assert.deepEqual(retries[1].body, retries[0].body);
	assert.equal([...state.remote.values()][0].length, 4);
	assert.deepEqual(state.records(), []);
});

test("user Given private pending capture When restarting at another destination Then old data stays dormant and storage has no credentials", async (t) => {
	const state = await fixture(t);
	const host = await state.start();
	await host.turn();
	assert.equal(state.records()[0].messages.length, 2);
	assert.equal(state.calls.length, 0);
	state.setMode("failure");
	await host.plugin.dispose();
	const other = await state.start({
		settings: { "nowledgeMem.apiKey": "different-secret" },
	});
	await other.quit();
	assert.equal(state.calls.length, 1);
	await other.turn("new-thread", "new-destination");
	await other.quit();
	assert.equal(state.calls.length, 2);
	assert.doesNotMatch(JSON.stringify(state.calls[1].body), /first user/);
	const text = readFileSync(
		join(state.storagePath, "thread-sync-outbox.json"),
		"utf8",
	);
	assert.doesNotMatch(
		text,
		/synthetic-secret|different-secret|127\.0\.0\.1|Authorization/,
	);
	if (process.platform !== "win32") {
		assert.equal(statSync(join(state.storagePath, "thread-sync-outbox.json")).mode & 0o777, 0o600);
	}
	assert.equal(state.records().length, 2);
});

for (const mode of ["serial-create", "serial-reconcile"]) {
	test(`user Given ${mode} When recovery needs another request Then it uses only the remaining lifecycle budget`, async (t) => {
		const state = await fixture(t);
		state.setMode(mode);
		const host = await state.start();
		await host.turn();

		const quitting = host.quit();
		await state.waitForRequest();
		mock.timers.tick(1_350);
		await state.waitForRequest(() => state.calls.length === 2);
		mock.timers.tick(1_150);
		await quitting;
		await state.waitForClosed(1);
		assert.equal(state.calls.length, 2);
		assert.equal(state.records()[0].savedCount, 0);
		assert.ok(state.records()[0].attempt);
		await host.plugin.dispose();
	});
}

test("user Given atomic replacement is obstructed When flushing Then the previous file survives and unsafe HTTP is prevented", async (t) => {
	const state = await fixture(t);
	const host = await state.start();
	await host.turn();
	const path = join(state.storagePath, "thread-sync-outbox.json");
	const backup = `${path}.backup`;
	const original = readFileSync(path, "utf8");
	renameSync(path, backup);
	mkdirSync(path);
	await host.flush();
	await host.quit();
	assert.equal(state.calls.length, 0);
	assert.equal(readFileSync(backup, "utf8"), original);
	assert.ok(state.errors.some((error) => /EISDIR|ENOTDIR|EEXIST|EPERM|EACCES/.test(error)));
	rmSync(path, { recursive: true });
	renameSync(backup, path);
	await host.events.get("thread.activated")({ threadId: "thread" });
	await host.flush();
	assert.deepEqual([...state.remote.values()].flat().map(message => message.content), ["first user", "first assistant"]);
	assert.deepEqual(state.records(), []);
});

for (const mode of ["bad-ack", "bad-create-id", "bad-create-count"]) {
	test(`user Given ${mode} When a reply arrives Then ACK does not advance and the journal remains`, async (t) => {
		const state = await fixture(t);
		state.setMode(mode);
		const host = await state.start();
		await host.turn();
		await host.quit();
		assert.equal(state.records()[0].savedCount, 0);
		assert.equal(state.records()[0].acknowledged, null);
		assert.ok(state.records()[0].attempt);
		assert.equal(state.calls.length, mode === "bad-ack" ? 1 : 2);
	});
}

test("user Given capture disabled at activation When enabled later Then the previous pending turn is recovered", async (t) => {
	const state = await fixture(t);
	state.setMode("failure");
	const old = await state.start();
	await old.turn();
	await old.plugin.dispose();
	mock.timers.tick(1);
	const host = await state.start({
		settings: { "nowledgeMem.autoCapture": false },
	});
	host.change({ "nowledgeMem.autoCapture": true });
	await host.turn("thread", "new");
	state.setMode("ok");
	await host.quit();
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["first user", "first assistant", "new user", "new assistant"],
	);
	assert.deepEqual(state.records(), []);
});

test("user Given a hydrated old lane When destination changes Then recovered private data is not replayed there", async (t) => {
	const state = await fixture(t);
	state.setMode("failure");
	const old = await state.start();
	await old.turn();
	await old.plugin.dispose();
	mock.timers.tick(1);
	const host = await state.start();
	host.change({ "nowledgeMem.apiKey": "new-lane-key" });
	await host.quit();
	assert.equal(state.calls.length, 1);
	await host.turn("thread", "new-lane");
	await host.quit();
	assert.equal(state.calls.length, 2);
	assert.deepEqual(
		state.calls[1].body.messages.map((message) => message.content),
		["new-lane user", "new-lane assistant"],
	);
	assert.equal(state.records().length, 2);
});

test("user Given a newer writer When the superseded activation captures Then it cannot overwrite the new outbox", async (t) => {
	const state = await fixture(t);
	const old = await state.start();
	await old.turn();
	const current = await state.start();
	await current.turn("thread", "new");
	const saved = JSON.stringify(state.records());
	await assert.rejects(old.turn("thread", "stale"), /writer superseded/);
	assert.equal(JSON.stringify(state.records()), saved);
	await current.quit();
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["first user", "first assistant", "new user", "new assistant"],
	);
});

test("user Given an acknowledged prefix and pending tail When LRU eviction and revisit occur Then the cursor and tail survive without duplicates", async (t) => {
	const state = await fixture(t);
	const host = await state.start();
	await host.turn();
	await host.flush();
	await host.events.get("chat.message.willSend")({
		threadId: "thread",
		content: "tail user",
	});
	for (let index = 0; index < 21; index += 1) {
		await host.events.get("chat.message.willSend")({
			threadId: `other-${index}`,
			content: "incomplete",
		});
	}
	await host.events.get("chat.message.didReceive")({
		threadId: "thread",
		response: { content: "tail assistant" },
	});
	await host.quit();
	const tail = state.calls.filter(call => call.body.expected_message_count === 2);
	assert.equal(tail.length, 1);
	assert.deepEqual(
		tail[0].body.messages.map((message) => message.content),
		["tail user", "tail assistant"],
	);
	assert.ok(state.records().every((record) => record.threadId !== "thread"));
	const deliveredRequests = state.calls.length;
	await host.quit();
	await host.plugin.dispose();
	assert.equal(state.calls.length, deliveredRequests);
	assert.deepEqual([...state.remote.values()].flat().map(message => message.content), ["first user", "first assistant", "tail user", "tail assistant"]);
});

test("user Given malformed outbox records When activating Then synchronization fails before hooks register", async (t) => {
	const state = await fixture(t);
	const path = join(state.storagePath, "thread-sync-outbox.json");
	writeFileSync(path, "[null]");
	let registrations = 0;
	await assert.rejects(
		state.start({
			context: {
				events: {
					on() {
						registrations += 1;
					},
				},
			},
		}),
		/thread-sync-outbox\.json \(invalid records\)/,
	);
	assert.equal(registrations, 0);
	assert.equal(readFileSync(path, "utf8"), "[null]");
});

test("user Given a restored private A queue When switching to B and back Then only A receives its recovered data", async (t) => {
	const state = await fixture(t);
	const destinationB = await fixture(t);
	state.setMode("failure");
	const old = await state.start();
	await old.turn("thread", "private A");
	await old.plugin.dispose();
	mock.timers.tick(1);
	const pendingA = state.records();
	const host = await state.start();
	host.change({ "nowledgeMem.apiUrl": destinationB.apiUrl });
	await host.quit();
	assert.equal(destinationB.calls.length, 0);
	assert.deepEqual(state.records(), pendingA);
	await host.turn("thread", "private B");
	await host.quit();
	assert.deepEqual(
		[...destinationB.remote.values()][0].map((message) => message.content),
		["private B user", "private B assistant"],
	);
	assert.deepEqual(state.records(), pendingA);
	await host.plugin.dispose();
	state.setMode("ok");
	const returned = await state.start();
	await returned.quit();
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["private A user", "private A assistant"],
	);
	assert.deepEqual(state.records(), []);
});

test("user Given disposed capture When a queued settings callback fires Then removed storage is not recreated", async (t) => {
	const state = await fixture(t);
	const host = await state.start();
	await host.events.get("chat.message.willSend")({
		threadId: "late",
		content: "pending",
	});
	await host.plugin.dispose();
	const path = join(state.storagePath, "thread-sync-outbox.json");
	rmSync(path);
	host.change({ "nowledgeMem.apiKey": "new-lane-key" });
	assert.throws(() => statSync(path), { code: "ENOENT" });
	assert.equal(state.calls.length, 0);
});

test("user Given a hanging host title API When teardown starts Then buffered fallback delivers without waiting", async (t) => {
	const state = await fixture(t);
	let titleCalls = 0;
	const host = await state.start({
		context: {
			chat: {
				getThread() {
					titleCalls += 1;
					return new Promise(() => {});
				},
			},
		},
	});
	await host.turn();
	const start = Date.now();
	await host.quit();
	assert.equal(titleCalls, 0);
	assert.ok(Date.now() - start < 2_500);
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["first user", "first assistant"],
	);
	assert.deepEqual(state.records(), []);
});

test("user Given corrupt outbox JSON When activating Then failure preserves original data", async (t) => {
	const state = await fixture(t);
	const path = join(state.storagePath, "thread-sync-outbox.json");
	writeFileSync(path, "not-json");
	await assert.rejects(
		state.start(),
		/thread-sync-outbox\.json \(invalid JSON\)/,
	);
	assert.equal(readFileSync(path, "utf8"), "not-json");
	assert.equal(state.calls.length, 0);
});

for (const corruption of ["token", "truncated", "record"]) {
	test(`user Given outbox ${corruption} When activation fails Then real process diagnostics exclude sensitive content`, async (t) => {
		const state = await fixture(t);
		const marker = "PRIVACY42";
		const original = {
			token: `[{"content":${marker}}]`,
			truncated: `[{"content":"${marker}",`,
			record: JSON.stringify([{ content: marker }]),
		}[corruption];
		const path = join(state.storagePath, "thread-sync-outbox.json");
		writeFileSync(path, original);
		const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
import { activate } from ${JSON.stringify(new URL("../main.js", import.meta.url).href)};
try {
 await activate({ storagePath: process.argv[1], logger: console, events: { on() { console.error("UNEXPECTED_HOOK"); } }, settings: { get() {} } });
 process.exitCode = 2;
} catch (error) {
 console.error(error.message, error.stack, JSON.stringify(error, Object.getOwnPropertyNames(error)));
 process.exitCode = 1;
}
`, state.storagePath], { encoding: "utf8", timeout: 3_000 });
		assert.ifError(child.error);
		assert.equal(child.status, 1);
		const diagnostics = child.stdout + child.stderr;
		assert.doesNotMatch(diagnostics, /PRIVACY42|UNEXPECTED_HOOK/);
		assert.match(diagnostics, corruption === "record" ? /invalid records/ : /invalid JSON/);
		assert.match(diagnostics, /Sync has not started; the original file is retained/);
		assert.match(diagnostics, /Back up.*restore a valid copy or contact support/);
		assert.equal(readFileSync(path, "utf8"), original);
		assert.equal(state.calls.length, 0);
	});
}

for (const dimension of ["apiUrl", "apiKey", "space"]) {
	test(`user Given private recovered data When ${dimension} migration persistence fails Then the old lane stays isolated and recoverable`, async (t) => {
		const state = await fixture(t);
		const destination = dimension === "apiUrl" ? await fixture(t) : state;
		const patch = {
			[`nowledgeMem.${dimension}`]:
				dimension === "apiUrl" ? destination.apiUrl : "destination-b",
		};
		state.setMode("failure");
		const originalHost = await state.start();
		await originalHost.turn("recovered", "PRIVATE_A");
		await originalHost.plugin.dispose();
		mock.timers.tick(1);
		state.setMode("ok");
		const host = await state.start();
		await host.events.get("chat.message.willSend")({
			threadId: "live",
			content: "live user",
		});
		const path = join(state.storagePath, "thread-sync-outbox.json");
		const backup = `${path}.backup`;
		const before = readFileSync(path, "utf8");
		const recovered = state
			.records()
			.find((record) => record.threadId === "recovered");
		renameSync(path, backup);
		mkdirSync(path);
		try {
			assert.throws(() => host.change(patch));
		} finally {
			rmSync(path, { recursive: true });
			renameSync(backup, path);
		}
		assert.equal(readFileSync(path, "utf8"), before);
		const callsBefore = destination.calls.length;
		await host.quit();
		assert.equal(destination.calls.length, callsBefore);
		await host.turn("recovered", "PUBLIC_B");
		await host.flush();
		const sent = destination.calls.slice(callsBefore);
		assert.ok(sent.length > 0);
		assert.equal(JSON.stringify(sent).includes("PRIVATE_A"), false);
		assert.deepEqual(
			sent[0].body.messages.map((message) => message.content),
			["PUBLIC_B user", "PUBLIC_B assistant"],
		);
		assert.deepEqual(
			state
				.records()
				.find(
					(record) =>
						record.destinationKey === recovered.destinationKey &&
						record.threadId === "recovered",
				),
			recovered,
		);
		await host.plugin.dispose();
		const restored = await state.start();
		const recoveryStart = state.calls.length;
		await restored.quit();
		assert.ok(
			state.calls
				.slice(recoveryStart)
				.some(
					(call) =>
						call.body.messages.some(
							(message) => message.content === "PRIVATE_A user",
						) && call.path.includes("/append"),
				),
		);
		assert.equal(
			state.records().some((record) => record.threadId === "recovered"),
			false,
		);
	});
}

for (const phase of ["freeze", "ack"]) {
	test(`user Given a real rename obstruction during ${phase} When saving and restarting Then the old journal and exact remote messages survive`, async (t) => {
		const state = await fixture(t);
		const host = await state.start();
		await host.turn();
		await host.flush();
		await host.turn("thread", "next");
		const path = join(state.storagePath, "thread-sync-outbox.json");
		const backup = `${path}.backup`;
		let flushing;
		let release;
		if (phase === "ack") {
			release = state.holdNextResponse();
			flushing = host.flush();
			await state.waitForRequest(call => call.body.expected_message_count === 2);
		}
		const original = readFileSync(path, "utf8");
		const checkpoint = JSON.parse(original).find((record) => record.threadId === "thread");
		renameSync(path, backup);
		mkdirSync(path);
		try {
			release?.();
			await (flushing ?? host.flush());
			const tailRequests = state.calls.filter(call => call.body.expected_message_count === 2);
			assert.equal(tailRequests.length, phase === "freeze" ? 0 : 1);
			assert.equal(readFileSync(backup, "utf8"), original);
			assert.equal(checkpoint.savedCount, 2);
			assert.equal(Boolean(checkpoint.attempt), phase === "ack");
			assert.equal(readdirSync(state.storagePath).some((name) => name.endsWith(".tmp")), false);
			assert.ok(state.errors.some((error) => /EISDIR|ENOTDIR|EEXIST|EPERM|EACCES/.test(error)));
		} finally {
			rmSync(path, { recursive: true });
			renameSync(backup, path);
		}
		const restarted = await state.start();
		await restarted.quit();
		await host.plugin.dispose();
		assert.deepEqual([...state.remote.values()][0].map((message) => message.content), ["first user", "first assistant", "next user", "next assistant"]);
		assert.deepEqual(state.records().filter((record) => record.threadId === "thread"), []);
		if (phase === "ack") {
			const replay = state.calls.filter(call => call.body.expected_message_count === 2);
			assert.equal(replay.length, 2);
			assert.deepEqual(replay[0].body, replay[1].body);
		}
	});
}

test("user Given native filesystem persistence When an outbox is reopened Then durable content survives with no temporary files", async (t) => {
	const { openSyncOutbox } = await import("../sync-outbox.js");
	const storagePath = mkdtempSync(join(tmpdir(), "outbox-native-"));
	t.after(() => rmSync(storagePath, { recursive: true, force: true }));
	const outbox = openSyncOutbox(storagePath, {});
	const buffer = {
		title: "synthetic native persistence", messages: [{ role: "user", content: "synthetic marker" }],
		savedCount: 0, acknowledged: null, destinationKey: `${"a".repeat(64)}\0`,
		nowledgeThreadId: null, attempt: null,
	};
	outbox.save("synthetic", buffer);
	assert.deepEqual(openSyncOutbox(storagePath, {}).records(buffer.destinationKey), [{ threadId: "synthetic", ...buffer }]);
	assert.equal(readdirSync(storagePath).some((name) => name.endsWith(".tmp")), false);
});

for (const timing of ["during", "after", "disposed"]) {
	test(`user Given an assistant arriving ${timing} cancelled quit When the idle deadline passes Then disposal and resumed capture respect lifecycle boundaries`, async (t) => {
		const state = await fixture(t);
		state.setMode("hang");
		const host = await state.start();
		await host.turn("first");
		await host.events.get("chat.message.willSend")({
			threadId: "second",
			content: "second user",
		});

		const quitting = host.events.get("app.willQuit")({}, { cancel: true });
		await state.waitForRequest();
		if (timing === "after") { mock.timers.tick(2_500); await quitting; }
		await host.events.get("chat.message.didReceive")({
			threadId: "second",
			response: { content: "second assistant" },
		});
		if (timing !== "after") mock.timers.tick(2_500);
		await quitting;
		state.setMode("ok");
		if (timing === "disposed") await host.plugin.dispose();
		mock.timers.tick(7_150);
		if (timing !== "disposed") {
			await state.waitForRequest((call) => call.body.messages.some((message) => message.content === "second assistant"));
			await host.quit();
		}
		const secondRequests = state.calls.filter((call) =>
			call.body.messages.some(
				(message) => message.content === "second assistant",
			),
		);
		if (timing === "disposed") assert.equal(secondRequests.length, 0);
		const secondVisible = [...state.remote.values()].flat().filter(message => message.content.startsWith("second "));
		assert.deepEqual(secondVisible.map(message => message.content), timing === "disposed" ? [] : ["second user", "second assistant"]);
		assert.equal(
			state.records().some((record) => record.threadId === "second"),
			timing === "disposed",
		);
		await host.plugin.dispose();
	});
}
