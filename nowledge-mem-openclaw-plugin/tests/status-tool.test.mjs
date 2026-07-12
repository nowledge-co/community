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
		toolsProfile: "coding",
		toolsAlsoAllow: ["openclaw-nowledge-mem"],
		allowConversationAccess: true,
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
	assert.equal(result.details.pluginToolsAllowed, true);
	assert.equal(result.details.allowConversationAccess, true);

	const blocked = await createStatusTool(client, logger, cfg, {
		memorySlot: "openclaw-nowledge-mem",
		contextEngineSlot: "nowledge-mem",
		contextEngineRegistered: true,
		toolsProfile: "coding",
		toolsAlsoAllow: [],
		allowConversationAccess: false,
	}).execute();
	assert.equal(blocked.details.pluginToolsAllowed, false);
	assert.equal(blocked.details.captureMode, "context-engine");
	assert.match(blocked.content[0].text, /Tool policy does not expose/);
	assert.match(blocked.content[0].text, /Hook fallback blocked/);
});

test("status tool separates CLI health from thread sync HTTP health", async () => {
	const client = {
		resolveCommand: async () => ["nmem"],
		checkHealth: async () => true,
		apiJson: async (_method, path) => {
			if (path === "/threads/sources") {
				throw new Error("HTTP 401");
			}
			return { version: "0.10.22", database_connected: true };
		},
	};
	const cfg = {
		sessionContext: false,
		sessionDigest: true,
		digestMinInterval: 300,
		maxContextResults: 5,
		recallMinScore: 55,
		maxThreadMessageChars: 4000,
		corpusSupplement: false,
		apiUrl: "https://example.nowledge-mem.com",
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
			apiUrl: "pluginConfig",
			apiKey: "default",
			space: "default",
		},
	};
	const tool = createStatusTool(client, logger, cfg, {
		memorySlot: "openclaw-nowledge-mem",
		contextEngineRegistered: false,
	});

	const result = await tool.execute();

	assert.equal(result.details.cliBackendReachable, true);
	assert.equal(result.details.healthy, false);
	assert.equal(result.details.httpBackendReachable, true);
	assert.equal(result.details.threadSyncHttpReachable, false);
	assert.equal(result.details.threadSyncHttpError, "HTTP 401");
	assert.match(result.content[0].text, /CLI backend: reachable/);
	assert.match(
		result.content[0].text,
		/Thread sync HTTP API: not reachable/,
	);
	assert.match(result.content[0].text, /Backend: partially reachable/);
	assert.match(
		result.content[0].text,
		/Conversation capture writes to the Mem HTTP API/,
	);
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
		allowConversationAccess: true,
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
		allowConversationAccess: true,
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
			/Fallback active: Nowledge Mem still injects startup context and uses its own recall path\./,
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
			/Fallback active: Nowledge Mem still injects startup context and uses its own recall path\./,
		);
		assert.match(
			result.content[0].text,
			/Fallback: Nowledge Mem tools remain available\. Enable sessionContext for prompt-time startup context and recall\./,
		);
	assert.match(
		result.content[0].text,
		/corpusSupplement runtime: configured but unavailable \(sessionContext disabled\)/,
	);
});
