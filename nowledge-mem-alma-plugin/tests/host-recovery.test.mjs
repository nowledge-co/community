import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import probe from "./host-recovery-probe.cjs";
import { fixture } from "./sync-fixture.mjs";

test("user Given synthetic persisted UIMessage records When the actual candidate loses ACK and restarts Then canonical IDs recover exactly once and pending empties", { timeout: 5_000 }, async (t) => {
	t.after(() => t.mock.timers.reset());
	t.mock.timers.enable({ apis: ["setTimeout", "Date"], now: Date.now() });
	let active;
	t.after(async () => { await active?.dispose(); });
	const state = await fixture(t);
	const log = join(state.storagePath, "probe.jsonl");
	const settings = join(state.storagePath, "settings.json");
	writeFileSync(settings, JSON.stringify({ "nowledgeMem.recallPolicy": "off", "nowledgeMem.autoCapture": true, "nowledgeMem.apiUrl": state.apiUrl, "nowledgeMem.apiKey": "synthetic-A" }));
	writeFileSync(join(state.storagePath, "probe-config.json"), JSON.stringify({ log, settings, threadId: "synthetic-owned", marker: "SYNTHETIC_CANONICAL", candidateModule: fileURLToPath(new URL("../main.js", import.meta.url)) }));
	const context = { extensionPath: state.storagePath, storagePath: state.storagePath, events: { on() { return { dispose() {} }; } } };
	state.setMode("create-lost");
	const first = await probe.activate(context);
	active = first;
	const disposing = first.dispose();
	await state.waitForRequest(() => state.calls.length === 2);
	t.mock.timers.tick(4_500);
	await disposing;
	await state.waitForClosed(1);
	assert.equal(state.records()[0].savedCount, 0);
	assert.ok(state.records()[0].attempt);
	const stored = JSON.parse(readFileSync(join(state.storagePath, "probe-records.json"), "utf8"));
	assert.deepEqual(stored.map(({ id, role, content }) => [id, role, content.id, content.role]), [
		["synthetic-owned-user", "user", "synthetic-owned-user", "user"],
		["synthetic-owned-assistant", "assistant", "synthetic-owned-assistant", "assistant"],
	]);
	state.setMode("ok");
	const restarted = await probe.activate(context);
	active = restarted;
	await restarted.dispose();
	assert.deepEqual(state.records(), []);
	const checkpoint = state.receipts();
	assert.equal(checkpoint.length, 1);
	assert.deepEqual(checkpoint[0].messages.map(({ external_id }) => external_id), stored.map(({ id }) => id));
	assert.equal(state.calls[0].path.endsWith("/append"), true);
	assert.equal(state.calls[1].path, "/threads");
	assert.deepEqual(state.calls[0].body, state.calls[2].body);
	const again = await probe.activate(context);
	active = again;
	await again.dispose();
	assert.deepEqual(state.receipts(), checkpoint);
	assert.equal(state.calls.length, 3);
	assert.deepEqual([...state.remote.values()][0].map(({ content }) => content), ["SYNTHETIC_CANONICAL user", "SYNTHETIC_CANONICAL assistant"]);
	assert.doesNotMatch(JSON.stringify(state.calls), /TRANSFORMED/);
});
