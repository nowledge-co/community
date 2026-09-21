import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	renameSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, mock } from "node:test";

import { fixture } from "./sync-fixture.mjs";

mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
after(() => mock.timers.reset());

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
