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
