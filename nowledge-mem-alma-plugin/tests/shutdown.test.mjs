import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { activate } from "../main.js";

async function fixture(t) {
	const storagePath = mkdtempSync(join(tmpdir(), "alma-sync-test-"));
	const calls = [];
	const remote = new Map();
	const keys = new Map();
	let mode = "ok";
	let closed = 0;
	const server = createServer(async (request, response) => {
		let content = "";
		for await (const chunk of request) content += chunk;
		const body = JSON.parse(content);
		const call = { path: request.url, body, closed: false };
		calls.push(call);
		response.on("close", () => {
			if (!response.writableEnded) {
				call.closed = true;
				closed += 1;
			}
		});
		const reply = (status, data) => {
			response.writeHead(status, { "content-type": "application/json" });
			response.end(JSON.stringify(data));
		};
		if (mode === "hang") return;
		if (mode === "body-hang") {
			response.writeHead(200, { "content-type": "application/json" });
			response.write('{"success":');
			return;
		}
		if (mode === "failure") return reply(503, { error: "unavailable" });
		if (mode === "bad-ack")
			return reply(200, {
				success: true,
				append_mode: "checkpointed",
				messages_added: 0,
				total_messages: 0,
			});
		if (mode.startsWith("bad-create")) {
			if (request.url !== "/threads")
				return reply(404, { error_code: "thread_not_found" });
			return reply(200, {
				thread: {
					thread_id: mode === "bad-create-id" ? "wrong-id" : body.thread_id,
					message_count: mode === "bad-create-count" ? 1 : 2,
				},
			});
		}
		if (mode === "slow") await delay(2_700);
		if (mode.startsWith("serial-")) await delay(1_350);
		if (mode === "serial-create" && request.url !== "/threads")
			return reply(404, { error_code: "thread_not_found" });
		if (
			mode === "serial-reconcile" &&
			!body.idempotency_key.endsWith(":reconcile")
		)
			return reply(409, { error_code: "checkpoint_conflict" });
		const threadId = body.thread_id ?? request.url.split("/")[2];
		if (request.url === "/threads") {
			if (!remote.has(threadId)) remote.set(threadId, body.messages);
			if (mode === "create-lost") return;
			return reply(200, {
				thread: {
					thread_id: threadId,
					message_count: remote.get(threadId).length,
				},
			});
		}
		if (mode === "create-lost" && !remote.has(threadId))
			return reply(404, { error_code: "thread_not_found" });
		if (keys.has(body.idempotency_key))
			return reply(200, keys.get(body.idempotency_key));
		const stored = remote.get(threadId) ?? [];
		if (
			body.expected_message_count !== undefined &&
			body.expected_message_count !== stored.length
		) {
			return reply(409, { error_code: "checkpoint_conflict" });
		}
		const duplicatePrefix =
			body.expected_message_count === undefined &&
			body.messages.every(
				(message, index) =>
					JSON.stringify(message) === JSON.stringify(stored[index]),
			);
		const added = duplicatePrefix ? [] : body.messages;
		remote.set(threadId, [...stored, ...added]);
		const ack = {
			success: true,
			append_mode: "checkpointed",
			messages_added: added.length,
			total_messages: stored.length + added.length,
		};
		keys.set(body.idempotency_key, ack);
		if (mode === "lost") return;
		reply(200, ack);
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const apiUrl = `http://127.0.0.1:${server.address().port}`;
	const plugins = [];
	const errors = [];
	const start = async (overrides = {}) => {
		const events = new Map();
		const settings = {
			"nowledgeMem.recallPolicy": "off",
			"nowledgeMem.autoCapture": true,
			"nowledgeMem.apiUrl": apiUrl,
			"nowledgeMem.apiKey": "synthetic-secret",
			...overrides.settings,
		};
		let changed;
		const context = {
			storagePath,
			logger: {
				info() {},
				debug() {},
				warn() {},
				error(message) {
					errors.push(message);
				},
			},
			settings: {
				get: (key) => settings[key],
				onDidChange(fn) {
					changed = fn;
					return { dispose() {} };
				},
			},
			events: {
				on(name, handler) {
					events.set(name, handler);
					return {
						dispose() {
							events.delete(name);
						},
					};
				},
			},
			...overrides.context,
		};
		const plugin = await activate(context);
		plugins.push(plugin);
		return {
			plugin,
			events,
			change(patch) {
				Object.assign(settings, patch);
				changed();
			},
			async turn(threadId = "thread", prefix = "first") {
				await events.get("chat.message.willSend")({
					threadId,
					content: `${prefix} user`,
				});
				events.get("chat.message.didReceive")({
					threadId,
					response: { content: `${prefix} assistant` },
				});
			},
			flush: () => events.get("thread.activated")({ threadId: "away" }),
			quit: () => events.get("app.willQuit")(),
		};
	};
	t.after(async () => {
		mode = "ok";
		await Promise.all(plugins.map((plugin) => plugin.dispose()));
		server.closeAllConnections();
		await new Promise((resolve) => server.close(resolve));
		rmSync(storagePath, { recursive: true, force: true });
	});
	return {
		start,
		calls,
		remote,
		errors,
		storagePath,
		apiUrl,
		setMode(value) {
			mode = value;
		},
		get closed() {
			return closed;
		},
		records: () =>
			JSON.parse(
				readFileSync(join(storagePath, "thread-sync-outbox.json"), "utf8"),
			),
	};
}

async function until(predicate) {
	const end = Date.now() + 2_000;
	while (!predicate()) {
		assert.ok(Date.now() < end, "observation did not arrive");
		await delay(10);
	}
}

function withinBudget(elapsed, budget) {
	console.info(`lifecycle elapsed=${elapsed}ms budget=${budget}ms`);
	assert.ok(
		elapsed >= budget - 100 && elapsed < budget + 400,
		`elapsed=${elapsed} budget=${budget}`,
	);
}

test("normal automatic HTTP can exceed the quit budget without being aborted", async (t) => {
	const state = await fixture(t);
	state.setMode("slow");
	const host = await state.start();
	await host.turn();
	const start = Date.now();
	await host.flush();
	assert.ok(Date.now() - start >= 2_650);
	assert.equal(state.calls.length, 1);
	assert.equal(state.closed, 0);
	assert.deepEqual(state.records(), []);
});

test("in-flight HTTP, duplicate quit and dispose share one total deadline across threads", async (t) => {
	const state = await fixture(t);
	state.setMode("hang");
	const host = await state.start();
	await host.turn("first");
	const running = host.flush();
	await until(() => state.calls.length === 1);
	await host.turn("second");
	await host.turn("third");
	const start = Date.now();
	await Promise.all([host.quit(), host.quit(), host.plugin.dispose(), running]);
	withinBudget(Date.now() - start, 2_500);
	await until(() => state.closed === 3);
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

test("dispose alone aborts HTTP body consumption within its total budget", async (t) => {
	const state = await fixture(t);
	state.setMode("body-hang");
	const host = await state.start();
	await host.turn();
	const start = Date.now();
	await host.plugin.dispose();
	withinBudget(Date.now() - start, 4_500);
	await until(() => state.closed === 1);
	assert.equal(state.records()[0].savedCount, 0);
	assert.equal(state.calls.length, 1);
});

test("teardown releases an in-flight title wait, sends HTTP, and ignores late title completion", async (t) => {
	const state = await fixture(t);
	let release;
	let titleCalls = 0;
	const host = await state.start({
		context: {
			chat: {
				getThread() {
					titleCalls += 1;
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
	await until(() => titleCalls === 1);
	const start = Date.now();
	await Promise.all([host.quit(), running]);
	assert.ok(Date.now() - start < 2_500);
	assert.equal(state.calls.length, 1);
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["first user", "first assistant"],
	);
	assert.deepEqual(state.records(), []);
	release({ title: "late" });
	await delay(30);
	assert.equal(titleCalls, 1);
	assert.equal(state.calls.length, 1);
	assert.deepEqual(state.records(), []);
});

test("title fallback starts HTTP without extending the shared quit deadline", async (t) => {
	const state = await fixture(t);
	state.setMode("hang");
	let titleStarted = false;
	const host = await state.start({
		context: {
			chat: {
				getThread() {
					titleStarted = true;
					return new Promise(() => {});
				},
			},
		},
	});
	await host.turn();
	const running = host.flush();
	await until(() => titleStarted);
	const start = Date.now();
	const quitting = host.quit();
	await until(() => state.calls.length === 1);
	await Promise.all([quitting, running]);
	withinBudget(Date.now() - start, 2_500);
	await until(() => state.closed === 1);
	assert.equal(state.calls.length, 1);
	assert.equal(state.records()[0].savedCount, 0);
	assert.ok(state.records()[0].attempt);
});

for (const outcome of ["hang", "lost", "create-lost"]) {
	test(`restart replays frozen batch after ${outcome}, without duplicate remote messages`, async (t) => {
		const state = await fixture(t);
		state.setMode(outcome);
		const host = await state.start();
		await host.turn();
		const running = host.flush();
		await until(
			() => state.calls.length === (outcome === "create-lost" ? 2 : 1),
		);
		await host.turn("thread", "later");
		await Promise.all([host.quit(), running]);
		await until(() => state.closed === 1);
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
		assert.equal(appends.length, 3);
	});
}

test("lost checkpointed ACK replays the same expected count and idempotency key", async (t) => {
	const state = await fixture(t);
	const host = await state.start();
	await host.turn();
	await host.flush();
	state.setMode("lost");
	await host.turn("thread", "next");
	await host.quit();
	await until(() => state.closed === 1);
	assert.equal(state.records()[0].savedCount, 2);
	await host.plugin.dispose();
	state.setMode("ok");
	const restarted = await state.start();
	await restarted.quit();
	assert.equal(state.calls.length, 3);
	assert.equal(state.calls[1].body.expected_message_count, 2);
	assert.deepEqual(state.calls[2].body, state.calls[1].body);
	assert.equal([...state.remote.values()][0].length, 4);
	assert.deepEqual(state.records(), []);
});

test("outbox persists capture before quit, keeps destinations dormant, and contains no credentials", async (t) => {
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
	assert.equal(
		statSync(join(state.storagePath, "thread-sync-outbox.json")).mode & 0o777,
		0o600,
	);
	assert.equal(state.records().length, 2);
});

for (const mode of ["serial-create", "serial-reconcile"]) {
	test(`${mode} uses the remaining lifecycle budget, not a fresh timeout`, async (t) => {
		const state = await fixture(t);
		state.setMode(mode);
		const host = await state.start();
		await host.turn();
		const start = Date.now();
		await host.quit();
		withinBudget(Date.now() - start, 2_500);
		await until(() => state.closed === 1);
		assert.equal(state.calls.length, 2);
		assert.equal(state.records()[0].savedCount, 0);
		assert.ok(state.records()[0].attempt);
		await host.plugin.dispose();
	});
}

test("atomic replacement failure preserves the previous file and prevents HTTP", async (t) => {
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
	assert.ok(state.errors.some((error) => /EISDIR|ENOTDIR|EEXIST/.test(error)));
	rmSync(path, { recursive: true });
	renameSync(backup, path);
	await host.events.get("thread.activated")({ threadId: "thread" });
	await host.flush();
	assert.equal(state.calls.length, 1);
	assert.deepEqual(state.records(), []);
});

for (const mode of ["bad-ack", "bad-create-id", "bad-create-count"]) {
	test(`${mode} never advances ACK or removes the journal`, async (t) => {
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

test("capture enabled after activation recovers the previous pending turn", async (t) => {
	const state = await fixture(t);
	state.setMode("failure");
	const old = await state.start();
	await old.turn();
	await old.plugin.dispose();
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

test("changing destination after hydration never replays the recovered old lane", async (t) => {
	const state = await fixture(t);
	state.setMode("failure");
	const old = await state.start();
	await old.turn();
	await old.plugin.dispose();
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

test("a superseded activation cannot overwrite the new writer's outbox", async (t) => {
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

test("LRU eviction and revisit retain the persisted cursor and pending tail", async (t) => {
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
	host.events.get("chat.message.didReceive")({
		threadId: "thread",
		response: { content: "tail assistant" },
	});
	await host.quit();
	assert.equal(state.calls.length, 2);
	assert.equal(state.calls[1].body.expected_message_count, 2);
	assert.deepEqual(
		state.calls[1].body.messages.map((message) => message.content),
		["tail user", "tail assistant"],
	);
	assert.ok(state.records().every((record) => record.threadId !== "thread"));
});

test("valid JSON with malformed records fails before hook registration", async (t) => {
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

test("restored A queue stays dormant across runtime URL switch to B and resumes only in A", async (t) => {
	const state = await fixture(t);
	const destinationB = await fixture(t);
	state.setMode("failure");
	const old = await state.start();
	await old.turn("thread", "private A");
	await old.plugin.dispose();
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

test("queued settings callback after dispose cannot recreate a removed outbox", async (t) => {
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

test("teardown uses buffered title fallback without calling a hanging host API", async (t) => {
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
	assert.equal(state.calls.length, 1);
	assert.deepEqual(
		[...state.remote.values()][0].map((message) => message.content),
		["first user", "first assistant"],
	);
	assert.deepEqual(state.records(), []);
});

test("corrupt outbox fails closed instead of overwriting recoverable data", async (t) => {
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
	test(`outbox ${corruption} diagnostics exclude sensitive content`, async (t) => {
		const state = await fixture(t);
		const marker = "PRIVACY42";
		const original = {
			token: `[{"content":${marker}}]`,
			truncated: `[{"content":"${marker}",`,
			record: JSON.stringify([{ content: marker }]),
		}[corruption];
		const path = join(state.storagePath, "thread-sync-outbox.json");
		writeFileSync(path, original);
		const diagnostics = [];
		let hooks = 0;
		const logger = Object.fromEntries(
			["info", "warn", "error", "debug", "log"].map((level) => [
				level,
				(...args) => diagnostics.push(args.join(" ")),
			]),
		);
		t.mock.method(process.stderr, "write", (chunk) => {
			diagnostics.push(String(chunk));
			return true;
		});
		for (const level of Object.keys(logger))
			t.mock.method(console, level, logger[level]);
		try {
			await assert.rejects(
				state.start({
					context: {
						logger,
						events: {
							on() {
								hooks += 1;
							},
						},
					},
				}),
				(error) => {
					assert.equal(error.cause, undefined);
					diagnostics.push(error.message, error.stack);
					diagnostics.push(
						JSON.stringify(error, Object.getOwnPropertyNames(error)),
					);
					assert.equal(diagnostics.join("\n").includes(marker), false);
					assert.match(error.message, /thread-sync-outbox\.json/);
					assert.match(
						error.message,
						corruption === "record" ? /invalid records/ : /invalid JSON/,
					);
					assert.match(
						error.message,
						/Sync has not started; the original file is retained/,
					);
					assert.match(
						error.message,
						/Back up.*restore a valid copy or contact support/,
					);
					return true;
				},
			);
		} finally {
			t.mock.restoreAll();
		}
		assert.equal(diagnostics.join("\n").includes(marker), false);
		assert.equal(readFileSync(path, "utf8"), original);
		assert.equal(hooks, 0);
		assert.equal(state.calls.length, 0);
	});
}

for (const dimension of ["apiUrl", "apiKey", "space"]) {
	test(`recovered lane stays private after ${dimension} migration write failure`, async (t) => {
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

for (const timing of ["during", "after", "disposed"]) {
	test(`assistant arriving ${timing} cancelled quit preserves lifecycle boundaries`, async (t) => {
		const state = await fixture(t);
		state.setMode("hang");
		const host = await state.start();
		await host.turn("first");
		await host.events.get("chat.message.willSend")({
			threadId: "second",
			content: "second user",
		});
		const quitting = host.events.get("app.willQuit")({}, { cancel: true });
		await until(() => state.calls.length === 1);
		if (timing === "after") await quitting;
		host.events.get("chat.message.didReceive")({
			threadId: "second",
			response: { content: "second assistant" },
		});
		await quitting;
		state.setMode("ok");
		if (timing === "disposed") await host.plugin.dispose();
		await delay(7_150);
		const secondRequests = state.calls.filter((call) =>
			call.body.messages.some(
				(message) => message.content === "second assistant",
			),
		);
		assert.equal(secondRequests.length, timing === "disposed" ? 0 : 1);
		assert.equal(
			state.records().some((record) => record.threadId === "second"),
			timing === "disposed",
		);
		await host.plugin.dispose();
	});
}
