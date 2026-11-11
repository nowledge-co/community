// Injected memory block packing (https://github.com/nowledge-co/mem/issues/9940).
import assert from "node:assert/strict";
import test from "node:test";

import { buildMemoryContextBlock } from "../main.js";

const memory = (title, content, extra = {}) => ({ title, content, score: 0.8, ...extra });

test("save dates are identified separately from event dates", () => {
	const block = buildMemoryContextBlock(null, [memory("Schedule", "The event date is unknown.", { createdAt: "2026-11-07T00:00:00Z" })]);
	assert.match(block, /\[saved:2026-11-07\]/);
	assert.doesNotMatch(block, /\[2026-11-07\]/);
	assert.match(block, /a save date does not establish when an event happened/);
});

test("a fact deep in a long memory survives and items are dated", () => {
	const content = `${"背景说明。".repeat(60)}发件域名是 play-chain.com。`;
	const block = buildMemoryContextBlock(null, [
		memory("可疑招聘邮件", content, { sourceRecordedAt: "2026-08-26T09:00:00Z", createdAt: "2026-11-07T00:00:00Z" }),
	]);
	assert.match(block, /play-chain\.com/);
	assert.match(block, /\[2026-08-26\] 可疑招聘邮件/);
	assert.doesNotMatch(block, /2026-11-07/);
	assert.match(block, /Today is \d{4}-\d{2}-\d{2}/);
});

test("memories are packed within the budget", () => {
	const items = Array.from({ length: 10 }, (_, i) => memory(`m${i}`, "x".repeat(1500)));
	items.push(memory("small", "fits"));
	const block = buildMemoryContextBlock(null, items);
	const section = block.split("## Relevant Memories\n")[1].split("\n\n")[0];
	assert.ok(section.length <= 6400, `section ${section.length}`);
	assert.match(block, /small/);
});

const update = (memoryId, title, statedAt) => ({
	memory_id: memoryId,
	title,
	relation: "enriches",
	stated_at: statedAt,
	is_latest: true,
});

test("an updated memory names its newer version and the newer one is appended", () => {
	const older = memory("Heartbeat cron", "runs 0 6-20 * * *", {
		id: "cron",
		laterUpdates: [update("paused", "Heartbeat paused", "2026-10-29T08:00:00+00:00")],
	});
	const lines = buildMemoryContextBlock(null, [older]).split("\n");
	const cron = lines.findIndex((line) => line.includes("Heartbeat cron"));
	assert.equal(lines[cron + 1], "   → updated later (2026-10-29): Heartbeat paused");
	assert.equal(lines[cron + 2], "2. updated later (2026-10-29): Heartbeat paused (newer version of a memory above)");

	const newer = memory("Heartbeat paused", "paused since October 29", { id: "paused" });
	assert.doesNotMatch(buildMemoryContextBlock(null, [older, newer]), /newer version of a memory above/);
});

test("an appended newer version carries its excerpt", () => {
	const older = memory("Heartbeat cron", "runs 0 6-20 * * *", {
		id: "cron",
		laterUpdates: [{ ...update("paused", "Heartbeat paused", "2026-10-29"), excerpt: "paused\n since Oct 29" }],
	});
	assert.match(
		buildMemoryContextBlock(null, [older]),
		/2\. updated later \(2026-10-29\): Heartbeat paused \(newer version of a memory above\): paused since Oct 29/,
	);
});

test("appended newer versions are newest first", () => {
	const older = memory("Old", "x", {
		id: "old",
		laterUpdates: ["03", "09", "05"].map((d) => update(`n${d}`, `Update ${d}`, `2026-10-${d}`)),
	});
	const appended = buildMemoryContextBlock(null, [older])
		.split("\n")
		.filter((line) => line.includes("newer version"));
	assert.deepEqual(
		appended.map((line) => line.match(/: (Update \d+)/)[1]),
		["Update 09", "Update 05", "Update 03"],
	);
});
