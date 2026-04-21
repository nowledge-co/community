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
	assert.equal(result.details.space, null);
	assert.equal(result.details.spaceSource, "default");
	assert.match(
		result.content[0].text,
		/Context Engine slot: nowledge-mem \(active\)/,
	);
	assert.match(result.content[0].text, /Ambient space:/);
});

test("status tool treats the plugin id as a compatible context engine slot", async () => {
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
		contextEngineSlot: "openclaw-nowledge-mem",
		contextEngineRegistered: true,
	});

	const result = await tool.execute();

	assert.equal(result.details.contextEngineSlot, "openclaw-nowledge-mem");
	assert.equal(result.details.captureMode, "context-engine+hooks");
	assert.match(
		result.content[0].text,
		/Context Engine slot: openclaw-nowledge-mem \(active via compatibility alias\)/,
	);
	assert.match(
		result.content[0].text,
		/OpenClaw selected the plugin id for the context-engine slot/,
	);
});

test("status tool reports legacy context engine when slot is unset", async () => {
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
		contextEngineRegistered: false,
	});

	const result = await tool.execute();

	assert.equal(result.details.contextEngineSlot, "legacy");
	assert.equal(result.details.captureMode, "hooks");
	assert.match(
		result.content[0].text,
		/Context Engine slot: legacy \(default\)/,
	);
});

test("status tool reports configured-but-unavailable corpus supplement with recall fallback", async () => {
	const client = {
		resolveCommand: async () => ["nmem"],
		checkHealth: async () => true,
		apiJson: async () => ({ version: "0.6.19", database_connected: true }),
	};
	const cfg = {
		sessionContext: true,
		sessionDigest: true,
		digestMinInterval: 300,
		maxContextResults: 5,
		recallMinScore: 55,
		maxThreadMessageChars: 4000,
		corpusSupplement: true,
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
			corpusSupplement: "pluginConfig",
			apiUrl: "default",
			apiKey: "default",
			space: "default",
		},
	};
	const tool = createStatusTool(client, logger, cfg, {
		memorySlot: "memory-core",
		contextEngineRegistered: false,
		corpusSupplementActive: false,
		corpusSupplementRegistrationError:
			"registerMemoryCorpusSupplement unavailable",
	});

	const result = await tool.execute();

	assert.equal(result.details.corpusSupplementConfigured, true);
	assert.equal(result.details.corpusSupplementActive, false);
	assert.match(
		result.content[0].text,
		/corpusSupplement is configured, but host registration is unavailable in this runtime\./,
	);
	assert.match(
		result.content[0].text,
		/Fallback active: Nowledge Mem still injects Working Memory and uses its own recall path\./,
	);
	assert.match(
		result.content[0].text,
		/corpusSupplement runtime: configured but unavailable \(fallback to plugin recall\)/,
	);
});

test("status tool avoids fallback recall claim when sessionContext is disabled", async () => {
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
		corpusSupplement: true,
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
			corpusSupplement: "pluginConfig",
			apiUrl: "default",
			apiKey: "default",
			space: "default",
		},
	};
	const tool = createStatusTool(client, logger, cfg, {
		memorySlot: "memory-core",
		contextEngineRegistered: false,
		corpusSupplementActive: false,
		corpusSupplementRegistrationError:
			"registerMemoryCorpusSupplement unavailable",
	});

	const result = await tool.execute();

	assert.doesNotMatch(
		result.content[0].text,
		/Fallback active: Nowledge Mem still injects Working Memory and uses its own recall path\./,
	);
	assert.match(
		result.content[0].text,
		/Fallback: Nowledge Mem tools remain available\. Enable sessionContext for prompt-time Working Memory and recall\./,
	);
	assert.match(
		result.content[0].text,
		/corpusSupplement runtime: configured but unavailable \(sessionContext disabled\)/,
	);
});
