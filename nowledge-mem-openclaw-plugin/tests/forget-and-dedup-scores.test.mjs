import assert from "node:assert/strict";
import test from "node:test";

import { createForgetCommand } from "../src/commands/slash.js";
import { createForgetTool } from "../src/tools/forget.js";
import { createSaveTool } from "../src/tools/save.js";

// Some backends scale scores to the top hit of each batch, so the first
// result reads 1.0 for any query (https://github.com/nowledge-co/mem/issues/11091).
const logger = { info() {}, warn() {}, error() {}, debug() {} };

function fakeClient(results) {
	const calls = [];
	return {
		calls,
		async search() {
			return results;
		},
		async searchRich() {
			return results;
		},
		async exec(args) {
			calls.push(args);
			return {};
		},
		async execJson(args) {
			calls.push(args);
			return { id: "new-1", title: "t" };
		},
	};
}

const related = [
	{ id: "m-related-1", title: "Trip to Lisbon", content: "Went to Lisbon in May.", score: 1.0 },
	{ id: "m-related-2", title: "Lisbon food", content: "Loved the pastries.", score: 0.4 },
];

test("/forget with a query never deletes, even when the top score reads 1.0", async () => {
	const client = fakeClient(related);
	const out = await createForgetCommand(client, logger).handler({ args: "lisbon trip" });
	assert.equal(client.calls.filter((c) => c.includes("delete")).length, 0);
	assert.match(out.text, /m-related-1/u);
});

test("forget tool with a query and a single 1.0 hit lists it instead of deleting", async () => {
	const client = fakeClient([related[0]]);
	const out = await createForgetTool(client, logger).execute("t1", { query: "lisbon" });
	assert.equal(client.calls.filter((c) => c.includes("delete")).length, 0);
	assert.match(out.content[0].text, /m-related-1/u);
});

test("bare ID-like text only searches; deletion requires --id", async () => {
	const client = fakeClient(related);
	const command = createForgetCommand(client, logger);
	assert.match((await command.handler({ args: "m-related-1" })).text, /Use \/forget --id/u);
	assert.deepEqual(client.calls, []);
	await command.handler({ args: "--id m-related-1" });
	assert.deepEqual(client.calls, [["--json", "m", "delete", "-f", "m-related-1"]]);
});

test("save is not skipped for a related memory whose relative score reads 1.0", async () => {
	const client = fakeClient(related);
	const out = await createSaveTool(client, logger).execute("t2", {
		text: "Booked a second Lisbon trip for October.",
		title: "Second Lisbon trip",
	});
	assert.notEqual(out.details?.reason, "duplicate");
});

test("save is skipped only for an identical memory", async () => {
	const client = fakeClient(related);
	const out = await createSaveTool(client, logger).execute("t3", {
		text: "  went to LISBON in may. ",
		title: "Trip",
	});
	assert.equal(out.details?.reason, "duplicate");
	assert.equal(out.details?.existingId, "m-related-1");
});
