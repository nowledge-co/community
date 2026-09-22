import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

assert.equal(process.env.PR620_HOST_TEST, "1", "Set PR620_HOST_TEST=1 to authorize a dedicated first-turn observer");
const evidence = process.argv[2];
assert.ok(evidence && !existsSync(evidence), "Pass a new evidence directory");
mkdirSync(evidence, { recursive: true, mode: 0o700 });
const marker = `PR620_FIRST_${randomUUID()}`;
const targetThreadId = process.env.PR620_TARGET_THREAD;
assert.ok(targetThreadId, "Set PR620_TARGET_THREAD to an independently verified empty coding-harness thread");
const pluginId = `pr620-first-${randomUUID()}`;
const staging = mkdtempSync(join(tmpdir(), "pr620-first-"));
const log = join(evidence, "events.jsonl");
const ownership = join(evidence, "owned-thread.json");
const hostUrl = process.env.PR620_HOST_URL ?? "http://127.0.0.1:23001";
assert.equal(new URL(hostUrl).hostname, "127.0.0.1");
const result = { marker, pass: false, level: "host data-shape observer only; candidate plugin is not loaded", capture: "actual host hooks; user must choose a new coding-harness session" };
const save = () => writeFileSync(join(evidence, "result.json"), JSON.stringify(result, null, 2), { mode: 0o600 });
async function observe(context) {
	const fs = require("node:fs");
	const crypto = require("node:crypto");
	const config = JSON.parse(fs.readFileSync(`${context.extensionPath}/probe-config.json`, "utf8"));
	const text = (content) => typeof content === "string" ? content : (content ?? []).filter((part) => part.type === "text").map((part) => part.text).join("\n");
	const digest = (content) => crypto.createHash("sha256").update(content.replace(/\s+/g, " ").trim()).digest("hex");
	const record = (event, details = {}) => fs.appendFileSync(config.log, `${JSON.stringify({ event, time: new Date().toISOString(), ...details })}\n`, { mode: 0o600 });
	const target = config.targetThreadId;
	const unwrap = (first) => first?.input ?? first ?? {};
	const subscriptions = [context.events.on("chat.message.willSend", async (first, second) => {
		const input = unwrap(first);
		if (input.threadId !== target) return;
		const output = second ?? first?.output ?? {};
		record("willSend.enter", { inputKeys: Object.keys(input), outputKeys: Object.keys(output) });
		fs.writeFileSync(config.ownership, JSON.stringify({ threadId: target }), { mode: 0o600 });
		const messages = await context.chat.getMessages(target);
		const users = messages.filter((entry) => (entry.role ?? entry.content?.role) === "user");
		const current = users.at(-1)?.content;
		record("willSend", { count: messages.length, userCount: users.length, currentId: current?.id, currentIdPresent: Boolean(current?.id), markerDigest: digest(config.marker), inputDigest: digest(text(input.content)), partsDigest: digest(text(input.parts)), partsPresent: Array.isArray(input.parts), partTypes: Array.isArray(input.parts) ? input.parts.map((part) => part.type) : [], inputContainsMarker: text(input.content).includes(config.marker), partsContainMarker: text(input.parts).includes(config.marker), outputDigest: digest(text(output.content)), storedDigest: digest(text(current?.parts)), firstTurn: users.length === 1 });
	}), context.events.on("chat.message.didReceive", async (first) => {
		const input = unwrap(first);
		if (input.threadId !== target) return;
		record("didReceive.enter", { inputKeys: Object.keys(input) });
		const messages = await context.chat.getMessages(target);
		const current = messages.find((entry) => entry.content?.id === input.message?.id)?.content;
		record("didReceive", { count: messages.length, currentId: current?.id, currentIdPresent: Boolean(current?.id), inputDigest: digest(text(input.response?.content)), storedDigest: digest(text(current?.parts)) });
	})];
	record("ready");
	return { dispose() { subscriptions.forEach((subscription) => subscription.dispose()); record("disposed"); } };
}
const request = async (route, method = "GET", body) => {
	const response = await fetch(`${hostUrl}${route}`, { method, headers: { "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
	const text = await response.text();
	return { status: response.status, data: text ? JSON.parse(text) : null };
};
const inventory = async () => {
	const response = await request("/api/plugins");
	assert.equal(response.status, 200);
	return response.data.map(({ id, enabled, status }) => ({ id, enabled, status })).sort((left, right) => left.id.localeCompare(right.id));
};
let installationAttempted = false;
let baseline;
save();
try {
	baseline = await inventory();
	const initial = await request(`/api/threads/${encodeURIComponent(targetThreadId)}`);
	assert.equal(initial.status, 200);
	assert.equal(initial.data.messages.length, 0, "Target must be empty before observation");
	assert.equal(initial.data.model, process.env.PR620_EXPECTED_MODEL, "Target must use the expected coding-harness model");
	result.initialMessageCount = 0;
	result.modelMatched = true;
	writeFileSync(join(staging, "main.js"), `exports.activate = ${observe.toString()};\n`);
	writeFileSync(join(staging, "manifest.json"), JSON.stringify({ id: pluginId, name: "PR620 first-turn observer", version: "1.0.0", description: "Observe only an exact synthetic first-turn marker", author: { name: "First-turn test" }, main: "main.js", engines: { alma: "^0.1.0" }, type: "tool", permissions: ["fs:read", "fs:write", "chat:read"], activationEvents: ["onStartup"] }));
	writeFileSync(join(staging, "probe-config.json"), JSON.stringify({ marker, log, ownership, targetThreadId }));
	installationAttempted = true;
	const response = await request("/api/plugins", "POST", { sourcePath: staging });
	assert.equal(response.status, 201, JSON.stringify(response.data));
	assert.ok(existsSync(log));
	result.ready = true;
	save();
	console.log(JSON.stringify({ ready: true, marker }));
	const deadline = Date.now() + 300000;
	while (Date.now() < deadline && !readFileSync(log, "utf8").includes('"didReceive"')) await delay(500);
	const events = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
	const sent = events.find(({ event }) => event === "willSend");
	const received = events.find(({ event }) => event === "didReceive");
	if (!sent || !received) {
		result.blocker = "No completed synthetic first turn during observation window; send marker in a NEW coding-harness session after rearming observer";
	} else {
		const { threadId } = JSON.parse(readFileSync(ownership, "utf8"));
		const independent = await request(`/api/threads/${encodeURIComponent(threadId)}/messages`);
		assert.equal(independent.status, 200);
		assert.ok(Array.isArray(independent.data));
		const summaries = independent.data.map(({ message }) => ({ role: message.role, digest: createHash("sha256").update((message.parts ?? []).filter(({ type }) => type === "text").map(({ text }) => text).join("\n").replace(/\s+/g, " ").trim()).digest("hex") }));
		result.independent = summaries;
		result.observations = { willSend: sent, didReceive: received };
		result.currentMessagesVisible = Boolean(sent.firstTurn && sent.currentIdPresent && received.currentIdPresent);
		result.userMarkerStored = sent.markerDigest === sent.storedDigest;
		result.hookUserContentMatchesStored = sent.inputDigest === sent.storedDigest;
		assert.ok(result.currentMessagesVisible);
		assert.ok(result.userMarkerStored);
		assert.equal(sent.inputDigest, sent.storedDigest);
		assert.equal(received.inputDigest, received.storedDigest);
		assert.ok(summaries.some(({ role, digest }) => role === "user" && digest === sent.inputDigest));
		assert.ok(summaries.some(({ role, digest }) => role === "assistant" && digest === received.inputDigest));
		result.pass = true;
	}
} catch (error) {
	result.error = error.message;
	process.exitCode = 1;
} finally {
	if (installationAttempted) {
		try {
			const removal = await request(`/api/plugins/${pluginId}`, "DELETE");
			result.pluginRemoved = removal.status === 204 || removal.status === 404;
			if (!result.pluginRemoved) process.exitCode = 1;
		} catch (error) {
			result.pluginRemoved = false;
			result.pluginRemovalError = error.message;
			process.exitCode = 1;
		}
	}
	if (baseline) {
		try {
			result.originalPluginsUnchanged = JSON.stringify(await inventory()) === JSON.stringify(baseline);
			if (!result.originalPluginsUnchanged) process.exitCode = 1;
		} catch (error) {
			result.originalPluginsUnchanged = false;
			result.inventoryError = error.message;
			process.exitCode = 1;
		}
	}
	try {
		rmSync(staging, { recursive: true, force: true });
	} catch (error) {
		result.stagingCleanupError = error.message;
		process.exitCode = 1;
	}
	save();
	console.log(JSON.stringify(result));
}
