import assert from "node:assert/strict";
import test from "node:test";
import { buildBehavioralHook } from "../src/hooks/behavioral.js";
import { ceState } from "../src/ce-state.js";
import { createThreadFetchTool } from "../src/tools/thread-fetch.js";
import { NowledgeMemClient } from "../src/client.js";

test("both live behavioral prompt variants bound thread reads", () => {
	const previous = ceState.active;
	ceState.active = false;
	try {
		for (const sessionContext of [false, true]) {
			const hook = buildBehavioralHook({}, { sessionContext });
			const prompt = hook({}, {}).appendSystemContext;
			assert.match(prompt, /at most one small targeted message range per question/);
			assert.match(prompt, /Never loop over offsets/);
			assert.match(prompt, /report the evidence gap and refine search/);
			assert.doesNotMatch(prompt, /full conversation context/);
		}
	} finally {
		ceState.active = previous;
	}
});

test("thread tool defaults to eight and preserves explicit target ranges", async () => {
	const calls = [];
	const tool = createThreadFetchTool({ fetchThread: async (id, options) => {
		calls.push(options);
		return { threadId: id, messages: [], messageCount: 0 };
	} }, {});
	assert.match(tool.parameters.properties.limit.description, /default 8/);
	await tool.execute("test", { threadId: "fixture" });
	await tool.execute("test", { threadId: "fixture", offset: 40, limit: 12 });
	assert.deepEqual(calls, [{ offset: 0, limit: 8 }, { offset: 40, limit: 12 }]);
});

test("client uses eight by default in CLI and API fallback", async () => {
	for (const fallback of [false, true]) {
		const client = Object.create(NowledgeMemClient.prototype);
		client.logger = { warn() {} };
		let cliArgs, apiPath;
		client.execJson = async (args) => {
			cliArgs = args;
			if (fallback) throw new Error("unrecognized arguments");
			return { messages: [] };
		};
		client.apiJson = async (_method, path) => { apiPath = path; return { messages: [] }; };
		await client.fetchThread("fixture");
		assert.deepEqual(cliArgs, ["--json", "t", "show", "fixture", "-n", "8"]);
		if (fallback) assert.equal(apiPath, "/threads/fixture?limit=8");
		await client.fetchThread("fixture", { offset: 40, limit: 12 });
		assert.deepEqual(cliArgs.slice(-4), ["-n", "12", "--offset", "40"]);
		if (fallback) assert.equal(apiPath, "/threads/fixture?limit=12&offset=40");
	}
});
