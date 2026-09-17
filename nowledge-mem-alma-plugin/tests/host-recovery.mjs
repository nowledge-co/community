import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.PR620_HOST_TEST, "1", "Set PR620_HOST_TEST=1 to authorize a dedicated plugin and synthetic Mem thread");
const evidence = process.argv[2];
assert.ok(evidence, "Pass a new evidence directory");
assert.ok(!existsSync(evidence), "Evidence directory must not already exist");
mkdirSync(evidence, { recursive: true, mode: 0o700 });
const nonce = randomUUID();
const pluginId = `pr620-recovery-${nonce}`;
const threadId = `synthetic-${nonce}`;
const marker = `PR620_SYNTHETIC_${nonce}`;
const memId = `alma-${createHash("sha1").update(threadId).digest("hex").slice(0, 12)}`;
const hostUrl = process.env.PR620_HOST_URL ?? "http://127.0.0.1:23001";
const memUrl = process.env.PR620_MEM_URL ?? "http://127.0.0.1:14242";
for (const url of [hostUrl, memUrl]) assert.equal(new URL(url).hostname, "127.0.0.1");
const staging = mkdtempSync(join(tmpdir(), "pr620-host-"));
const settingsPath = join(evidence, "settings.json");
const log = join(evidence, "host.jsonl");
const results = { pluginId, memId, capture: "synthetic persisted UIMessage adapter + candidate in actual host; not native chat capture", lifecycle: "actual dedicated plugin disable/enable", requests: [], cleanup: {} };
const save = () => writeFileSync(join(evidence, "result.json"), JSON.stringify(results, null, 2), { mode: 0o600 });
const request = async (base, route, method = "GET", body) => {
	const response = await fetch(base + route, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
	const text = await response.text();
	return { status: response.status, data: text ? JSON.parse(text) : null };
};
const inventory = async () => {
	const response = await request(hostUrl, "/api/plugins");
	assert.equal(response.status, 200);
	return response.data.map(({ id, enabled, status, version }) => ({ id, enabled, status, version })).sort((left, right) => left.id.localeCompare(right.id));
};
let mode = "lose-ack";
let storagePath;
let baseline;
let installationAttempted = false;
let remoteOwned = false;
const upstreamRequests = new Set();
const proxy = createServer(async (incoming, outgoing) => {
	try {
		let text = "";
		for await (const chunk of incoming) text += chunk;
		const body = JSON.parse(text);
		assert.equal(incoming.method, "POST");
		assert.ok(incoming.url === "/threads" || incoming.url === `/threads/${memId}/append`);
		if (incoming.url === "/threads") assert.equal(body.thread_id, memId);
		assert.deepEqual(body.messages.map(({ role, content }) => ({ role, content })), [{ role: "user", content: `${marker} user` }, { role: "assistant", content: `${marker} assistant` }]);
		const forwarding = request(memUrl, incoming.url, "POST", body);
		upstreamRequests.add(forwarding);
		let upstream;
		try { upstream = await forwarding; } finally { upstreamRequests.delete(forwarding); }
		results.requests.push({ path: incoming.url, upstreamStatus: upstream.status, mode, digest: createHash("sha256").update(text).digest("hex"), key: body.idempotency_key ?? null, expected: body.expected_message_count ?? null });
		save();
		const lost = mode === "lose-ack" && upstream.status >= 200 && upstream.status < 300;
		outgoing.writeHead(lost ? 503 : upstream.status, { "content-type": "application/json" });
		outgoing.end(JSON.stringify(lost ? { error: "synthetic lost acknowledgement" } : upstream.data));
	} catch (error) {
		results.proxyError = error.message;
		save();
		outgoing.writeHead(500).end();
	}
});
const setDestination = (key) => writeFileSync(settingsPath, JSON.stringify({ "nowledgeMem.recallPolicy": "off", "nowledgeMem.autoCapture": true, "nowledgeMem.apiUrl": `http://127.0.0.1:${proxy.address().port}`, "nowledgeMem.apiKey": key }), { mode: 0o600 });
const lifecycle = async (action) => {
	const response = await request(hostUrl, `/api/plugins/${pluginId}/${action}`, "POST");
	assert.equal(response.status, 200);
};
const until = async (predicate) => {
	const deadline = Date.now() + 15000;
	while (!(await predicate())) {
		assert.ok(Date.now() < deadline, "Expected observation did not arrive within 15 seconds");
		await delay(100);
	}
};
const records = () => JSON.parse(readFileSync(join(storagePath, "thread-sync-outbox.json"), "utf8"));
const readback = async () => {
	const response = await request(memUrl, `/threads/${memId}`);
	assert.equal(response.status, 200);
	assert.deepEqual(response.data.messages.map(({ role, content }) => ({ role, content })), [{ role: "user", content: `${marker} user` }, { role: "assistant", content: `${marker} assistant` }]);
	assert.equal(new Set(response.data.messages.map(({ id }) => id)).size, 2);
	return { count: response.data.messages.length, digest: createHash("sha256").update(response.data.messages.map(({ content }) => content).join("\n")).digest("hex") };
};
save();
try {
	baseline = await inventory();
	assert.ok(!baseline.some(({ id }) => id === pluginId));
	assert.equal((await request(memUrl, `/threads/${memId}`)).status, 404);
	remoteOwned = true;
	await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
	setDestination("synthetic-A");
	copyFileSync(fileURLToPath(new URL("./host-recovery-probe.cjs", import.meta.url)), join(staging, "main.js"));
	writeFileSync(join(staging, "manifest.json"), JSON.stringify({ id: pluginId, name: "PR620 isolated recovery test", version: "1.0.0", description: "Isolated synthetic candidate recovery test", author: { name: "Recovery test" }, main: "main.js", engines: { alma: "^0.1.0" }, type: "tool", permissions: ["fs:read", "fs:write", "chat:read", "settings:read"], activationEvents: ["onStartup"] }));
	writeFileSync(join(staging, "probe-config.json"), JSON.stringify({ log, settings: settingsPath, threadId, marker, candidateModule: fileURLToPath(new URL("../main.js", import.meta.url)) }));
	installationAttempted = true;
	const install = await request(hostUrl, "/api/plugins", "POST", { sourcePath: staging });
	assert.equal(install.status, 201, JSON.stringify(install.data));
	await until(() => existsSync(log) && readFileSync(log, "utf8").includes('"activate"'));
	storagePath = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse).find(({ event }) => event === "activate").storagePath;
	assert.equal(basename(storagePath), pluginId);
	await until(() => results.requests.some(({ upstreamStatus }) => upstreamStatus >= 200 && upstreamStatus < 300));
	results.beforeRecovery = await readback();
	await lifecycle("disable");
	assert.equal(records()[0].savedCount, 0);
	assert.ok(records()[0].attempt);
	const originalRecords = records();
	const beforeDormant = results.requests.length;
	setDestination("synthetic-B");
	mode = "pass";
	await lifecycle("enable");
	await lifecycle("disable");
	assert.equal(results.requests.length, beforeDormant);
	assert.deepEqual(records(), originalRecords);
	results.destinationIsolation = { newRequests: 0, retained: true };
	setDestination("synthetic-A");
	await lifecycle("enable");
	await until(() => records().every((record) => record.savedCount === record.messages.length && !record.attempt));
	const recovered = records().find((record) => record.threadId === threadId);
	assert.ok(recovered, "durable identity checkpoint retained");
	assert.deepEqual(recovered.messages.map(({ external_id }) => external_id), [`${threadId}-user`, `${threadId}-assistant`]);
	await lifecycle("disable");
	await lifecycle("enable");
	await lifecycle("disable");
	assert.deepEqual(records(), [recovered], "repeated canonical IDs do not recapture after restart");
	results.afterRecovery = await readback();
	assert.equal(results.requests.at(-1).key, results.requests[0].key);
	results.outboxRemaining = records().filter((record) => record.messages.length > record.savedCount || record.attempt).length;
	results.checkpointsRetained = records().length;
	results.pass = true;
	save();
} catch (error) {
	results.pass = false;
	results.error = error.message;
	process.exitCode = 1;
} finally {
	for (const [name, cleanup] of [
		["pluginRemoved", async () => {
			if (!installationAttempted) return;
			const removed = await request(hostUrl, `/api/plugins/${pluginId}`, "DELETE");
			assert.ok([204, 404].includes(removed.status));
			assert.ok(!(await inventory()).some(({ id }) => id === pluginId));
		}],
		["proxyClosed", async () => {
			proxy.closeAllConnections();
			await new Promise((resolve) => proxy.close(resolve));
			await Promise.allSettled([...upstreamRequests]);
		}],
		["remoteAbsent", async () => {
			if (!remoteOwned) return;
			const existing = await request(memUrl, `/threads/${memId}`);
			assert.ok([200, 404].includes(existing.status));
			if (existing.status === 200) {
				assert.ok(existing.data.messages.every(({ content }) => content.startsWith(marker)));
				assert.ok([200, 204].includes((await request(memUrl, `/threads/${memId}`, "DELETE")).status));
			}
			assert.equal((await request(memUrl, `/threads/${memId}`)).status, 404);
		}],
		["ownedStorageFilesRemoved", async () => {
			if (!storagePath) return;
			assert.equal(results.cleanup.pluginRemoved, true, "retain journal while plugin removal is unconfirmed");
			for (const name of ["thread-sync-outbox.json", "thread-sync-writer", "probe-captured", "probe-records.json"]) rmSync(join(storagePath, name), { force: true });
		}],
		["stagingRemoved", async () => { rmSync(staging, { recursive: true, force: true }); }],
		["originalPluginsUnchanged", async () => {
			if (baseline) assert.deepEqual(await inventory(), baseline);
		}],
	]) {
		try {
			await cleanup();
			results.cleanup[name] = true;
		} catch (error) {
			results.cleanup[name] = false;
			results.cleanup[`${name}Error`] = error.message;
			results.pass = false;
			process.exitCode = 1;
		}
		save();
	}
	console.log(JSON.stringify({ pass: results.pass, error: results.error, beforeRecovery: results.beforeRecovery, afterRecovery: results.afterRecovery, destinationIsolation: results.destinationIsolation, outboxRemaining: results.outboxRemaining, cleanup: results.cleanup }));
}
