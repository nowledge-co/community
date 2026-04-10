import test from "node:test";
import assert from "node:assert/strict";

import { parseConfig } from "../src/config.js";
import { NowledgeMemClient } from "../src/client.js";

const logger = {
	info() {},
	warn() {},
	debug() {},
	error() {},
};

test("parseConfig prefers configured space over ambient env", () => {
	const previous = process.env.NMEM_SPACE;
	process.env.NMEM_SPACE = "Env Space";
	try {
		const cfg = parseConfig({ space: "Configured Space" }, logger);
		assert.equal(cfg.space, "Configured Space");
		assert.equal(cfg._sources.space, "pluginConfig");
	} finally {
		if (previous === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previous;
	}
});

test("parseConfig resolves spaceTemplate with env interpolation", () => {
	const previous = process.env.OPENCLAW_AGENT_NAME;
	process.env.OPENCLAW_AGENT_NAME = "researcher";
	try {
		const cfg = parseConfig(
			{ spaceTemplate: "agent-${OPENCLAW_AGENT_NAME}" },
			logger,
		);
		assert.equal(cfg.space, "agent-researcher");
		assert.equal(cfg._sources.space, "pluginConfig:template");
	} finally {
		if (previous === undefined) delete process.env.OPENCLAW_AGENT_NAME;
		else process.env.OPENCLAW_AGENT_NAME = previous;
	}
});

test("client injects ambient space into API query and body paths", () => {
	const client = new NowledgeMemClient(
		logger,
		{ runCommandWithTimeout: async () => ({ code: 0 }) },
		{ apiUrl: "http://127.0.0.1:14242", space: "Research Agent" },
	);

	assert.equal(
		client._withSpaceQuery("/memories/search?q=hello"),
		"/memories/search?q=hello&space_id=Research+Agent",
	);
	assert.deepEqual(client._withSpaceBody({ title: "hello" }), {
		title: "hello",
		space_id: "Research Agent",
	});
});
