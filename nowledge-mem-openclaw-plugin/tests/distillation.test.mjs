import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { NowledgeMemClient } from "../src/client.js";
import { triageAndDistill } from "../src/hooks/capture.js";

const scheduled = {
	success: true,
	task_id: "distill-test-task",
	scheduled_at: "2026-10-18T00:00:00Z",
	delay_seconds: 5,
	task_type: "thread_distillation",
	thread_id: "oc-test-thread",
	message: "Distillation scheduled",
	recommended_execution_mode: "background_agent",
};

const captureResult = {
	threadId: "oc-test-thread",
	messagesAdded: 4,
	normalized: [
		{
			role: "user",
			fullContent: "We decided to keep backups for thirty days.",
		},
		{ role: "assistant", fullContent: "I will record the retention decision." },
		{
			role: "user",
			fullContent: "Run backups daily and verify recovery weekly.",
		},
		{
			role: "assistant",
			fullContent: "The daily backup plan includes weekly recovery checks.",
		},
	],
};

async function backend(t, { ack = scheduled, status = 200 } = {}) {
	const requests = [];
	const logs = { info: [], warn: [], debug: [] };
	const logger = Object.fromEntries(
		Object.keys(logs).map((level) => [
			level,
			(message) => logs[level].push(message),
		]),
	);
	const server = createServer(async (req, res) => {
		let text = "";
		for await (const chunk of req) text += chunk;
		const body = JSON.parse(text);
		const url = new URL(req.url, "http://localhost");
		requests.push({ method: req.method, url, body });
		res.setHeader("content-type", "application/json");
		if (url.pathname === "/memories/distill/triage") {
			res.end(
				JSON.stringify({ should_distill: true, reason: "Durable decision" }),
			);
		} else if (
			url.pathname !== "/memories/distill/schedule" ||
			"thread_content" in body
		) {
			res.statusCode = 400;
			res.end(
				JSON.stringify({
					detail: "Inline thread_content distillation is no longer supported",
				}),
			);
		} else {
			res.statusCode = status;
			res.end(JSON.stringify(ack));
		}
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => new Promise((resolve) => server.close(resolve)));
	const client = new NowledgeMemClient(
		logger,
		{},
		{
			apiUrl: `http://127.0.0.1:${server.address().port}`,
			space: "Test Space",
		},
	);
	return { client, logger, logs, requests };
}

test("distillThread schedules a stored thread without inline content and preserves its space", async (t) => {
	const { client, requests } = await backend(t);
	const result = await client.distillThread({
		threadId: "  oc-test-thread  ",
		title: "Backup policy",
	});
	assert.deepEqual(result, scheduled);
	assert.equal(requests.length, 1);
	assert.equal(requests[0].method, "POST");
	assert.equal(requests[0].url.pathname, "/memories/distill/schedule");
	assert.equal(requests[0].url.searchParams.get("space_id"), "Test Space");
	assert.deepEqual(requests[0].body, {
		thread_id: "oc-test-thread",
		thread_title: "Backup policy",
		distillation_type: "simple_llm",
		extraction_level: "swift",
		space_id: "Test Space",
	});
});

test("distillThread rejects missing thread IDs before making a request", async (t) => {
	const { client, requests } = await backend(t);
	for (const threadId of [undefined, null, "", "   "]) {
		await assert.rejects(
			client.distillThread({ threadId }),
			/requires threadId/,
		);
	}
	assert.equal(requests.length, 0);
});

test("capture logs background task acceptance without claiming completed memories", async (t) => {
	const { client, logger, logs, requests } = await backend(t);
	await triageAndDistill({
		client,
		logger,
		captureResult,
		ctx: {},
		cfg: { sessionDigest: true, digestMinInterval: 0 },
	});
	assert.equal(requests.length, 2);
	assert.ok(requests[0].body.thread_content.includes("thirty days"));
	assert.equal("thread_content" in requests[1].body, false);
	assert.deepEqual(logs.warn, []);
	assert.ok(
		logs.info.some((message) =>
			/scheduled.*oc-test-thread.*distill-test-task/.test(message),
		),
	);
	assert.ok(
		logs.info.every((message) => !/distilled \d+ memories/.test(message)),
	);
});

for (const [name, ack, status] of [
	["rejected", { ...scheduled, success: false }, 200],
	["missing task ID", { success: true }, 200],
	["empty task ID", { success: true, task_id: " " }, 200],
	["legacy synchronous response", { memories_created: 2 }, 200],
	["HTTP failure", { detail: "Scheduler unavailable" }, 503],
]) {
	test(`capture warns instead of reporting scheduling success for ${name}`, async (t) => {
		const { client, logger, logs } = await backend(t, { ack, status });
		await triageAndDistill({
			client,
			logger,
			captureResult,
			ctx: {},
			cfg: { sessionDigest: true, digestMinInterval: 0 },
		});
		assert.equal(logs.warn.length, 1);
		assert.match(logs.warn[0], /triage\/distill failed/);
		assert.match(
			logs.warn[0],
			status === 503
				? /Scheduler unavailable/
				: /scheduling was not acknowledged with a task ID/,
		);
		assert.ok(
			logs.info.every((message) => !/scheduled|distilled/.test(message)),
		);
	});
}
