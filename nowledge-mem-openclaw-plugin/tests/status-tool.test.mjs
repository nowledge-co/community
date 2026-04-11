import test from "node:test";
import assert from "node:assert/strict";

import { createStatusTool } from "../src/tools/status.js";

const logger = {
	info() {},
	warn() {},
	debug() {},
	error() {},
};

test("status tool reports the configured context engine slot", async () => {
	const client = {
		resolveCommand: async () => ["nmem"],
		checkHealth: async () => true,
		apiJson: async () => ({ version: "0.6.19", database_connected: true }),
	};
	const cfg = {
		sessionContext: false,
		sessionDigest: true,
		digestMinInterval: 300,
		maxContextResults: 5,
		recallMinScore: 55,
		maxThreadMessageChars: 4000,
		corpusSupplement: false,
		apiUrl: "http://127.0.0.1:14242",
		apiKey: "",
		space: "",
		_sources: {
			sessionContext: "default",
			sessionDigest: "default",
			digestMinInterval: "default",
			maxContextResults: "default",
			recallMinScore: "default",
			maxThreadMessageChars: "default",
			corpusSupplement: "default",
			apiUrl: "default",
			apiKey: "default",
			space: "default",
		},
	};
	const tool = createStatusTool(client, logger, cfg, {
		memorySlot: "openclaw-nowledge-mem",
		contextEngineSlot: "nowledge-mem",
		contextEngineRegistered: true,
	});

	const result = await tool.execute();

	assert.equal(result.details.contextEngineSlot, "nowledge-mem");
	assert.equal(result.details.captureMode, "context-engine+hooks");
	assert.match(result.content[0].text, /Context Engine slot: nowledge-mem \(active\)/);
});
