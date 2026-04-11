import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { parseConfig } from "../src/config.js";
import { NowledgeMemClient } from "../src/client.js";
import { buildNmemSpawnEnv } from "../src/spawn-env.js";

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

test("parseConfig does not evaluate lower-priority templates eagerly", () => {
	try {
		delete process.env.MISSING_OPENCLAW_SPACE;
		const cfg = parseConfig(
			{
				space: "Configured Space",
				spaceTemplate: "agent-${MISSING_OPENCLAW_SPACE}",
			},
			logger,
		);
		assert.equal(cfg.space, "Configured Space");
		assert.equal(cfg._sources.space, "pluginConfig");
	} finally {
		delete process.env.MISSING_OPENCLAW_SPACE;
	}
});

test("parseConfig preserves explicit empty space over ambient env", () => {
	const previous = process.env.NMEM_SPACE;
	process.env.NMEM_SPACE = "Env Space";
	try {
		const cfg = parseConfig({ space: "" }, logger);
		assert.equal(cfg.space, "");
		assert.equal(cfg._sources.space, "pluginConfig");
	} finally {
		if (previous === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previous;
	}
});

test("parseConfig rejects unknown keys in legacy file config", () => {
	const tempHome = mkdtempSync(join(tmpdir(), "nmem-openclaw-home-"));
	mkdirSync(join(tempHome, ".nowledge-mem"), { recursive: true });
	writeFileSync(
		join(tempHome, ".nowledge-mem", "openclaw.json"),
		JSON.stringify({ space: "Research Agent", typoKey: true }),
		"utf8",
	);
	const result = spawnSync(
		process.execPath,
		[
			"--input-type=module",
			"-e",
			`import { parseConfig } from ${JSON.stringify(new URL("../src/config.js", import.meta.url).pathname)}; parseConfig({}, console);`,
		],
		{
			env: { ...process.env, HOME: tempHome },
			encoding: "utf8",
		},
	);
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /unknown config key.*openclaw\.json/i);
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

test("client preserves explicit default-space choice over ambient env", () => {
	const previous = process.env.NMEM_SPACE;
	process.env.NMEM_SPACE = "Env Space";
	try {
		const client = new NowledgeMemClient(
			logger,
			{ runCommandWithTimeout: async () => ({ code: 0 }) },
			{ apiUrl: "http://127.0.0.1:14242", space: "" },
		);
		assert.equal(client._spaceRef, "");
	} finally {
		if (previous === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previous;
	}
});

test("spawn env clears inherited ambient lane for explicit default-space override", () => {
	const previousSpace = process.env.NMEM_SPACE;
	const previousSpaceId = process.env.NMEM_SPACE_ID;
	process.env.NMEM_SPACE = "Env Space";
	process.env.NMEM_SPACE_ID = "Env Space";
	try {
		const env = buildNmemSpawnEnv({
			apiUrl: "http://127.0.0.1:14242",
			hasExplicitSpace: true,
			spaceId: "",
		});
		assert.equal(env.NMEM_SPACE, undefined);
		assert.equal(env.NMEM_SPACE_ID, undefined);
	} finally {
		if (previousSpace === undefined) delete process.env.NMEM_SPACE;
		else process.env.NMEM_SPACE = previousSpace;
		if (previousSpaceId === undefined) delete process.env.NMEM_SPACE_ID;
		else process.env.NMEM_SPACE_ID = previousSpaceId;
	}
});

test("apiJson injects ambient space into fallback HTTP requests", async () => {
	const previousFetch = globalThis.fetch;
	const client = new NowledgeMemClient(
		logger,
		{ runCommandWithTimeout: async () => ({ code: 0 }) },
		{ apiUrl: "http://127.0.0.1:14242", space: "Research Agent" },
	);
	try {
		globalThis.fetch = async (url, init) => ({
			ok: true,
			text: async () => JSON.stringify({ url, body: init?.body ?? null }),
		});
		const response = await client.apiJson("POST", "/memories/search", { q: "hello" });
		assert.equal(
			response.url,
			"http://127.0.0.1:14242/memories/search?space_id=Research+Agent",
		);
		assert.deepEqual(JSON.parse(response.body), {
			q: "hello",
			space_id: "Research Agent",
		});
	} finally {
		globalThis.fetch = previousFetch;
	}
});
