// Recalled-knowledge block packing (https://github.com/nowledge-co/mem/issues/9940).
import assert from "node:assert/strict";
import test from "node:test";

import {
	RECALL_BUDGET_CHARS,
	RECALL_ITEM_CHARS,
	buildRecalledKnowledgeBlock,
} from "../src/hooks/recall.js";

const memory = (title, content, extra = {}) => ({
	title,
	content,
	score: 0.8,
	labels: [],
	...extra,
});

test("save dates do not become event dates", () => {
	const block = buildRecalledKnowledgeBlock([memory("Schedule", "The event date is unknown.", { createdAt: "2026-11-07T00:00:00Z" })]);
	assert.match(block, /\[saved:2026-11-07\]/);
	assert.doesNotMatch(block, /\[2026-11-07\]/);
	assert.match(block, /a save date does not establish when an event happened/);
});

test("a fact deep in a long memory is not cut away", () => {
	const content = `${"背景说明。".repeat(70)}发件域名是 play-chain.com。`;
	const block = buildRecalledKnowledgeBlock([memory("可疑招聘邮件", content)]);
	assert.match(block, /play-chain\.com/);
});

test("items carry the event or source-conversation date, not the import time", () => {
	const block = buildRecalledKnowledgeBlock([
		memory("软考", "中项已考完", { eventStart: "2026-10-24" }),
		memory("备份暂停", "每日备份已暂停", {
			sourceRecordedAt: "2026-10-29T08:00:00+00:00",
			createdAt: "2026-11-07T00:00:00+00:00",
		}),
	]);
	assert.match(block, /\[2026-10-24\] 软考/);
	assert.match(block, /\[2026-10-29\] 备份暂停/);
	assert.doesNotMatch(block, /2026-11-07/);
	assert.match(block, /Today is \d{4}-\d{2}-\d{2}/);
});

test("the block stays within budget and still admits a smaller item", () => {
	const big = "x".repeat(RECALL_ITEM_CHARS);
	const items = Array.from({ length: 8 }, (_, i) => memory(`m${i}`, big));
	items.push(memory("small", "still fits"));
	const block = buildRecalledKnowledgeBlock(items);
	const body = block.split("\n").slice(3, -1).join("\n");
	assert.ok(body.length <= RECALL_BUDGET_CHARS + 64, `body ${body.length}`);
	assert.match(block, /small/);
});
